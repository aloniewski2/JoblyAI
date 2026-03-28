const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/settings
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => {
    if (r.key !== 'gmail_tokens') { // never expose tokens
      settings[r.key] = r.value;
    }
  });
  res.json(settings);
});

// PUT /api/settings
router.put('/', (req, res) => {
  const allowed = ['auto_status_update', 'anthropic_api_key', 'ai_provider', 'ollama_url', 'ollama_model', 'groq_api_key'];
  const update = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  for (const [key, value] of Object.entries(req.body)) {
    if (allowed.includes(key)) {
      update.run(key, String(value));
    }
  }
  res.json({ success: true });
});

module.exports = router;
