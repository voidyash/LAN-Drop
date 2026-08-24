const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const HISTORY_PATH = path.join(__dirname, '..', '..', 'transfer-history.json');

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    }
  } catch { /* ignore */ }
  return [];
}

function saveHistory(history) {
  // Keep last 500 entries
  const trimmed = history.slice(-500);
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(trimmed, null, 2));
}

/** Record a transfer event. Called internally by other routes. */
function recordTransfer(entry) {
  const history = loadHistory();
  history.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    ...entry,
  });
  saveHistory(history);
}

// GET /api/history — list past transfers
router.get('/history', (_req, res) => {
  try {
    const history = loadHistory();
    res.json(history.reverse()); // newest first
  } catch {
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// DELETE /api/history — clear all history
router.delete('/history', (_req, res) => {
  try {
    saveHistory([]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

// DELETE /api/history/:id — delete single entry
router.delete('/history/:id', (req, res) => {
  try {
    const history = loadHistory();
    const filtered = history.filter((h) => h.id !== req.params.id);
    saveHistory(filtered);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

module.exports = router;
module.exports.recordTransfer = recordTransfer;
