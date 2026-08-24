const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { throttleStream, getDownloadBandwidth } = require('../bandwidth');
const { recordTransfer } = require('./history');

const router = express.Router();

let uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const chunksDir = path.join(__dirname, '..', '..', 'chunks');

if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    let finalName = originalName;
    let counter = 1;
    while (fs.existsSync(path.join(uploadsDir, finalName))) {
      const ext = path.extname(originalName);
      const base = path.basename(originalName, ext);
      finalName = `${base} (${counter})${ext}`;
      counter++;
    }
    cb(null, finalName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 * 1024,
  },
});

let lanPin = process.env.LAN_PIN || null;
let pinEnabled = !!lanPin;

/** Update the uploads directory at runtime */
function setUploadsDir(dir) {
  uploadsDir = dir;
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

/** Recursively list all files under a directory */
function listFilesRecursive(dir, prefix = '') {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full, rel));
    } else {
      const stats = fs.statSync(full);
      results.push({
        name: rel,
        size: stats.size,
        uploadedAt: stats.mtime.toISOString(),
      });
    }
  }
  return results;
}

function getLanIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();

  if (process.env.LAN_IP) {
    return process.env.LAN_IP;
  }

  const virtualKeywords = [
    'virtualbox', 'vmware', 'hyper-v', 'docker', 'wsl',
    'veth', 'br-', 'lo', 'utun', 'tun', 'tap',
    'pseudo', 'loopback', 'isatap', 'teredo', '6to4'
  ];

  const preferredNames = ['ethernet', 'wi-fi', 'wlan', 'wireless', 'lan', 'local area connection'];

  let fallbackIP = '127.0.0.1';

  for (const name of Object.keys(nets)) {
    const lowerName = name.toLowerCase();
    const isVirtual = virtualKeywords.some(kw => lowerName.includes(kw));
    if (isVirtual) continue;

    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        const isPreferred = preferredNames.some(pn => lowerName.includes(pn));
        if (isPreferred) return net.address;
        if (fallbackIP === '127.0.0.1') fallbackIP = net.address;
      }
    }
  }

  return fallbackIP;
}

router.get('/info', (_req, res) => {
  const lanIP = getLanIP();
  const port = _req.socket.localPort || 3000;
  res.json({
    lanIP,
    port,
    lanUrl: `http://${lanIP}:${port}`,
    localUrl: `http://127.0.0.1:${port}`,
  });
});

function deleteChunksDir(uploadId) {
  const dir = path.join(chunksDir, uploadId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

router.get('/files', (_req, res) => {
  try {
    const files = listFilesRecursive(uploadsDir);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

router.post('/upload', (req, res, next) => {
  if (req.io) {
    req.io.emit('upload_started', { timestamp: new Date().toISOString() });
  }
  next();
}, upload.array('files', 50), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const uploadedFiles = req.files.map((file) => ({
    name: file.filename,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  }));

  if (req.io) {
    uploadedFiles.forEach((file) => {
      req.io.emit('upload_completed', file);
    });
  }

  // Record in history
  uploadedFiles.forEach((file) => {
    recordTransfer({
      type: 'upload',
      filename: file.name,
      size: file.size,
    });
  });

  res.json({ files: uploadedFiles });
});

router.use('/upload', (err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    let message = 'Upload failed';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large. Maximum size is 100 GB.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files. Maximum is 50 files at once.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field.';
    }

    if (req.io) {
      req.io.emit('upload_failed', { error: message });
    }

    return res.status(400).json({ error: message });
  }

  if (req.io) {
    req.io.emit('upload_failed', { error: 'Upload failed' });
  }
  res.status(500).json({ error: 'Upload failed' });
});

router.get('/download/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const filePath = path.join(uploadsDir, filename);

  if (!filePath.startsWith(uploadsDir)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(filePath);
  let fileStream = fs.createReadStream(filePath);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(filename))}"`);
  res.setHeader('Content-Length', stat.size);

  // Apply bandwidth throttling
  const dlBps = getDownloadBandwidth();
  if (dlBps > 0) {
    fileStream = throttleStream(fileStream, dlBps);
  }

  fileStream.pipe(res);

  // Record download in history
  recordTransfer({
    type: 'download',
    filename: path.basename(filename),
    folder: path.dirname(filename) !== '.' ? path.dirname(filename) : undefined,
    size: stat.size,
  });
});

router.delete('/files/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const filePath = path.join(uploadsDir, filename);

  if (!filePath.startsWith(uploadsDir)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const stats = fs.statSync(filePath);
    fs.unlinkSync(filePath);
    if (req.io) {
      req.io.emit('file_deleted', { name: filename });
    }
    recordTransfer({
      type: 'delete',
      filename: path.basename(filename),
      folder: path.dirname(filename) !== '.' ? path.dirname(filename) : undefined,
      size: stats.size,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

router.post('/upload/init', (req, res) => {
  const { uploadId, filename, totalChunks, fileSize, encrypted, folder } = req.body;

  if (!uploadId || !filename || !totalChunks || !fileSize) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Sanitize uploadId to prevent path traversal
  const safeUploadId = path.basename(String(uploadId));

  // Check if file already fully uploaded
  const finalPath = path.join(uploadsDir, filename);
  if (fs.existsSync(finalPath)) {
    return res.status(409).json({ error: 'File already exists', completed: true });
  }

  const uploadDir = path.join(chunksDir, safeUploadId);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Write metadata
  fs.writeFileSync(path.join(uploadDir, 'meta.json'), JSON.stringify({
    filename,
    totalChunks,
    fileSize,
    encrypted: !!encrypted,
    folder: folder || '',
    startedAt: new Date().toISOString(),
  }));

  res.json({ success: true, uploadId: safeUploadId });
});

router.post('/upload/chunk', express.raw({ type: 'application/octet-stream', limit: '2mb' }), (req, res) => {
  const uploadId = String(req.query.uploadId || '');
  const index = parseInt(req.query.index, 10);
  const safeUploadId = path.basename(uploadId);

  if (!safeUploadId || isNaN(index) || index < 0) {
    return res.status(400).json({ error: 'Invalid uploadId or index' });
  }

  const uploadDir = path.join(chunksDir, safeUploadId);
  if (!fs.existsSync(uploadDir)) {
    return res.status(404).json({ error: 'Upload not found. Re-init upload.' });
  }

  const chunkFile = path.join(uploadDir, `chunk_${String(index).padStart(6, '0')}`);
  fs.writeFileSync(chunkFile, req.body);

  // Read metadata
  const metaPath = path.join(uploadDir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    return res.status(500).json({ error: 'Upload metadata missing' });
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

  // Check if all chunks received
  const receivedChunks = fs.readdirSync(uploadDir).filter(f => f.startsWith('chunk_'));

  if (receivedChunks.length >= meta.totalChunks) {
    // Assemble file — create subfolder if needed
    const targetDir = meta.folder ? path.join(uploadsDir, meta.folder) : uploadsDir;
    if (meta.folder && !fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const finalName = meta.folder ? path.join(meta.folder, meta.filename) : meta.filename;
    const finalPath = path.join(uploadsDir, finalName);
    const writeStream = fs.createWriteStream(finalPath);

    return new Promise((resolve, reject) => {
      let i = 0;
      function writeNext() {
        if (i >= receivedChunks.length) {
          writeStream.end(() => {
            // Cleanup chunks
            deleteChunksDir(safeUploadId);

            // Emit socket events
            if (req.io) {
              req.io.emit('upload_completed', {
                name: finalName,
                size: meta.fileSize,
                encrypted: meta.encrypted,
                uploadedAt: new Date().toISOString(),
              });
            }

            // Record upload in history
            recordTransfer({
              type: 'upload',
              filename: meta.filename,
              folder: meta.folder || undefined,
              size: meta.fileSize,
            });

            res.json({ status: 'completed', name: finalName });
            resolve();
          });
          return;
        }
        const chunkPath = path.join(uploadDir, receivedChunks[i]);
        const chunkData = fs.readFileSync(chunkPath);
        i++;
        if (!writeStream.write(chunkData)) {
          writeStream.once('drain', writeNext);
        } else {
          writeNext();
        }
      }
      writeNext();
    }).catch((err) => {
      console.error('Assembly error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'File assembly failed' });
      }
    });
  }

  res.json({
    status: 'chunk_received',
    received: receivedChunks.length,
    total: meta.totalChunks,
  });
});

router.get('/upload/status/:uploadId', (req, res) => {
  const safeUploadId = path.basename(String(req.params.uploadId));
  const uploadDir = path.join(chunksDir, safeUploadId);

  if (!fs.existsSync(uploadDir)) {
    return res.status(404).json({ error: 'Upload not found' });
  }

  const metaPath = path.join(uploadDir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    return res.status(500).json({ error: 'Upload metadata missing' });
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const receivedChunks = fs.readdirSync(uploadDir).filter(f => f.startsWith('chunk_'));

  res.json({
    receivedChunks: receivedChunks.length,
    totalChunks: meta.totalChunks,
    filename: meta.filename,
    fileSize: meta.fileSize,
    encrypted: meta.encrypted,
  });
});

router.delete('/upload/cancel/:uploadId', (req, res) => {
  const safeUploadId = path.basename(String(req.params.uploadId));
  deleteChunksDir(safeUploadId);
  res.json({ success: true });
});

router.post('/auth/pin', (req, res) => {
  if (!pinEnabled) {
    return res.json({ authenticated: true });
  }

  const { pin } = req.body;
  if (pin === lanPin) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false, error: 'Invalid PIN' });
  }
});

router.get('/auth/status', (_req, res) => {
  res.json({ pinEnabled });
});

module.exports = router;