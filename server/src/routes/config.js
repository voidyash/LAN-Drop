const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  setUploadBandwidth,
  setDownloadBandwidth,
  getUploadBandwidth,
  getDownloadBandwidth,
} = require('../bandwidth');

const router = express.Router();

// Persistent config file
const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch { /* ignore */ }
  return {
    uploadBandwidth: 0,
    downloadBandwidth: 0,
    storageDir: '',
  };
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// Apply saved config on startup
const initial = loadConfig();
if (initial.uploadBandwidth > 0) setUploadBandwidth(initial.uploadBandwidth);
if (initial.downloadBandwidth > 0) setDownloadBandwidth(initial.downloadBandwidth);

// GET /api/config — return current config
router.get('/config', (_req, res) => {
  const cfg = loadConfig();
  res.json({
    uploadBandwidth: getUploadBandwidth(),
    downloadBandwidth: getDownloadBandwidth(),
    storageDir: cfg.storageDir || '',
  });
});

// PUT /api/config — update config
router.put('/config', (req, res) => {
  const { uploadBandwidth, downloadBandwidth, storageDir } = req.body;
  const cfg = loadConfig();

  if (typeof uploadBandwidth === 'number') {
    cfg.uploadBandwidth = Math.max(0, uploadBandwidth);
    setUploadBandwidth(cfg.uploadBandwidth);
  }
  if (typeof downloadBandwidth === 'number') {
    cfg.downloadBandwidth = Math.max(0, downloadBandwidth);
    setDownloadBandwidth(cfg.downloadBandwidth);
  }
  if (typeof storageDir === 'string') {
    cfg.storageDir = storageDir;
  }

  saveConfig(cfg);

  res.json({
    uploadBandwidth: cfg.uploadBandwidth,
    downloadBandwidth: cfg.downloadBandwidth,
    storageDir: cfg.storageDir,
  });
});

module.exports = router;
module.exports.loadConfig = loadConfig;
