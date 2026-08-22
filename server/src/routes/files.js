const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

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

router.get('/files', (_req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir).map((filename) => {
      const filePath = path.join(uploadsDir, filename);
      const stats = fs.statSync(filePath);
      return {
        name: filename,
        size: stats.size,
        uploadedAt: stats.mtime.toISOString(),
      };
    });
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
  const fileStream = fs.createReadStream(filePath);

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Length', stat.size);

  fileStream.pipe(res);
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
    fs.unlinkSync(filePath);
    if (req.io) {
      req.io.emit('file_deleted', { name: filename });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
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