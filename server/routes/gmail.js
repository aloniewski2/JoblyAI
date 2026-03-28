const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const db = require('../db');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/gmail/callback';

  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getTokens() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'gmail_tokens'").get();
  if (!row?.value) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

// GET /api/gmail/status
router.get('/status', (req, res) => {
  const tokens = getTokens();
  const enabled = db.prepare("SELECT value FROM settings WHERE key = 'gmail_enabled'").get()?.value === 'true';
  const lastSync = db.prepare("SELECT value FROM settings WHERE key = 'gmail_last_sync'").get()?.value;
  const hasCredentials = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  res.json({
    connected: !!tokens && enabled,
    hasCredentials,
    lastSync: lastSync || null
  });
});

// GET /api/gmail/auth-url
router.get('/auth-url', (req, res) => {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return res.status(400).json({
      error: 'Google OAuth credentials not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env'
    });
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  res.json({ authUrl });
});

// GET /api/gmail/callback
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client || !code) return res.status(400).send('Invalid request');

  try {
    const { tokens } = await oauth2Client.getToken(code);
    db.prepare("UPDATE settings SET value=? WHERE key='gmail_tokens'").run(JSON.stringify(tokens));
    db.prepare("UPDATE settings SET value='true' WHERE key='gmail_enabled'").run();
    res.redirect('http://localhost:5173/settings?gmail=connected');
  } catch (err) {
    res.redirect('http://localhost:5173/settings?gmail=error');
  }
});

// POST /api/gmail/disconnect
router.post('/disconnect', (req, res) => {
  db.prepare("UPDATE settings SET value='' WHERE key='gmail_tokens'").run();
  db.prepare("UPDATE settings SET value='false' WHERE key='gmail_enabled'").run();
  res.json({ success: true });
});

// POST /api/gmail/sync — fetch and classify recent emails
router.post('/sync', async (req, res) => {
  const tokens = getTokens();
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client || !tokens) return res.status(400).json({ error: 'Gmail not connected' });

  oauth2Client.setCredentials(tokens);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: 'subject:(application OR interview OR recruiter OR offer OR rejection OR position OR opportunity) newer_than:30d'
    });

    if (!data.messages?.length) return res.json({ processed: 0, emails: [] });

    const processed = [];
    const insertEmail = db.prepare(`
      INSERT OR IGNORE INTO email_activities
        (gmail_message_id, subject, sender, sender_email, body_preview, classification, received_at, application_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const msg of (data.messages || []).slice(0, 30)) {
      try {
        const { data: msgData } = await gmail.users.messages.get({
          userId: 'me', id: msg.id, format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date']
        });

        const headers = msgData.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const dateStr = headers.find(h => h.name === 'Date')?.value || '';

        const emailMatch = from.match(/<(.+?)>/);
        const senderEmail = emailMatch ? emailMatch[1] : from;
        const senderName = from.replace(/<.*>/, '').trim().replace(/^"|"$/g, '');

        const snippet = msgData.snippet || '';
        const classification = classifyEmail(subject, snippet);

        const appId = matchApplicationToEmail(subject, senderEmail);

        insertEmail.run(msg.id, subject, senderName, senderEmail, snippet.slice(0, 500), classification, dateStr, appId);

        if (appId && process.env.AUTO_STATUS_UPDATE !== 'false') {
          autoUpdateStatus(appId, classification);
        }

        processed.push({ subject, classification, appId });
      } catch { /* skip individual message errors */ }
    }

    db.prepare("UPDATE settings SET value=? WHERE key='gmail_last_sync'").run(new Date().toISOString());

    res.json({ processed: processed.length, emails: processed });
  } catch (err) {
    if (err.code === 401) {
      db.prepare("UPDATE settings SET value='' WHERE key='gmail_tokens'").run();
      return res.status(401).json({ error: 'Gmail token expired. Please reconnect.' });
    }
    console.error('Gmail sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gmail/emails
router.get('/emails', (req, res) => {
  const { applicationId, limit = 50 } = req.query;
  let rows;
  if (applicationId) {
    rows = db.prepare('SELECT * FROM email_activities WHERE application_id = ? ORDER BY received_at DESC').all(applicationId);
  } else {
    rows = db.prepare(`
      SELECT ea.*, a.company, a.job_title
      FROM email_activities ea
      LEFT JOIN applications a ON ea.application_id = a.id
      ORDER BY ea.received_at DESC LIMIT ?
    `).all(parseInt(limit));
  }
  res.json(rows);
});

function classifyEmail(subject, snippet) {
  const text = `${subject} ${snippet}`.toLowerCase();

  if (/offer letter|we('re| are) pleased to offer|compensation package|accept.*offer/.test(text)) return 'offer';
  if (/rejected|not moving forward|decided to (go with|pursue) other|position.*filled|unfortunately/.test(text)) return 'rejection';
  if (/interview.*schedule|schedule.*interview|invite.*interview|interview.*invitation|interview.*time/.test(text)) return 'interview_request';
  if (/assessment|coding challenge|take.?home|online test|hackerrank|coderpad/.test(text)) return 'assessment';
  if (/application.*received|thank you.*appl|application.*confirm|we received your/.test(text)) return 'confirmation';
  if (/recruiter|opportunity|i came across|your profile|reaching out/.test(text)) return 'recruiter_outreach';
  if (/follow.?up|following up|checking in|next steps/.test(text)) return 'follow_up';

  return 'other';
}

function matchApplicationToEmail(subject, senderEmail) {
  const apps = db.prepare('SELECT id, company, recruiter_email FROM applications').all();

  for (const app of apps) {
    if (app.recruiter_email && senderEmail.toLowerCase().includes(app.recruiter_email.toLowerCase())) {
      return app.id;
    }
    const domain = senderEmail.split('@')[1]?.toLowerCase().replace(/^(mail|jobs|careers|recruiting|hr|noreply)\./i, '');
    const companyClean = app.company.toLowerCase().replace(/[^a-z]/g, '');
    if (domain && companyClean && (domain.includes(companyClean) || companyClean.includes(domain.split('.')[0]))) {
      return app.id;
    }
  }
  return null;
}

function autoUpdateStatus(appId, classification) {
  const app = db.prepare('SELECT status FROM applications WHERE id = ?').get(appId);
  if (!app) return;

  let newStatus = null;
  if (classification === 'rejection' && !['Rejected', 'Withdrawn'].includes(app.status)) {
    newStatus = 'Rejected';
  } else if (classification === 'offer' && app.status !== 'Offer') {
    newStatus = 'Offer';
  } else if (classification === 'interview_request' && ['Applied', 'Recruiter Screen', 'Interested'].includes(app.status)) {
    newStatus = 'Interview Round 1';
  } else if (classification === 'confirmation' && app.status === 'Interested') {
    newStatus = 'Applied';
  }

  if (newStatus) {
    db.prepare("UPDATE applications SET status=?, updated_at=datetime('now') WHERE id=?").run(newStatus, appId);
    db.prepare("INSERT INTO status_history (application_id, status, notes) VALUES (?, ?, ?)").run(
      appId, newStatus, `Auto-updated from Gmail: ${classification}`
    );
  }
}

module.exports = router;
