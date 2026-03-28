const express = require('express');
const router = express.Router();
const multer = require('multer');
const AdmZip = require('adm-zip');
const db = require('../db');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── CSV parser (no deps) ─────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (!lines.length) return [];

  const headers = splitCSVLine(lines[0]).map(h => h.trim().replace(/^\uFEFF/, '')); // strip BOM
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = splitCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, j) => { row[h] = (vals[j] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ── Column name normalisers ──────────────────────────────────────────────────

function pick(row, ...candidates) {
  for (const c of candidates) {
    const key = Object.keys(row).find(k => k.toLowerCase().replace(/[\s_-]/g, '') === c.toLowerCase().replace(/[\s_-]/g, ''));
    if (key && row[key]) return row[key];
  }
  return '';
}

function parseLinkedInDate(val) {
  if (!val) return new Date().toISOString().split('T')[0];
  // LinkedIn formats: "Jan 15, 2025" / "2025-01-15" / "01/15/2025"
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}

function mapStatus(val) {
  const v = (val || '').toLowerCase();
  if (v.includes('offer')) return 'Offer';
  if (v.includes('interview')) return 'Interview Round 1';
  if (v.includes('screen') || v.includes('recruiter')) return 'Recruiter Screen';
  if (v.includes('reject') || v.includes('declined') || v.includes('not selected')) return 'Rejected';
  if (v.includes('withdrawn') || v.includes('withdrew')) return 'Withdrawn';
  if (v.includes('hold') || v.includes('paused')) return 'On Hold';
  if (v.includes('viewed') || v.includes('in progress') || v.includes('applied')) return 'Applied';
  if (v.includes('saved') || v.includes('not yet')) return 'Interested';
  return 'Applied';
}

// ── Find and parse LinkedIn job apps CSV from a zip ─────────────────────────

function extractJobApps(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  // LinkedIn names it "Job Applicaions.csv" (typo included) or "Jobs/Job Applications.csv"
  const jobEntry = entries.find(e => {
    const n = e.entryName.toLowerCase();
    return (n.includes('job') && (n.includes('application') || n.includes('applicaion'))) ||
      n === 'job_applications.csv';
  });

  if (!jobEntry) {
    // List all CSV files so we can debug / pick the right one
    const csvFiles = entries.filter(e => e.entryName.toLowerCase().endsWith('.csv')).map(e => e.entryName);
    return { rows: null, csvFiles };
  }

  const text = jobEntry.getData().toString('utf8');
  const rows = parseCSV(text);
  return { rows, csvFiles: [] };
}

// ── POST /api/import/preview ─────────────────────────────────────────────────
// Accept a .zip or .csv, return parsed rows without inserting

router.post('/preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { mimetype, originalname, buffer } = req.file;
  const isZip = mimetype === 'application/zip' ||
    mimetype === 'application/x-zip-compressed' ||
    originalname.toLowerCase().endsWith('.zip');
  const isCSV = mimetype === 'text/csv' || originalname.toLowerCase().endsWith('.csv');

  let rows;

  if (isZip) {
    const result = extractJobApps(buffer);
    if (!result.rows) {
      return res.status(422).json({
        error: 'Could not find a job applications file in the zip.',
        hint: 'Found these CSVs: ' + (result.csvFiles.join(', ') || 'none'),
        csvFiles: result.csvFiles
      });
    }
    rows = result.rows;
  } else if (isCSV) {
    rows = parseCSV(buffer.toString('utf8'));
  } else {
    return res.status(400).json({ error: 'Please upload a .zip (LinkedIn archive) or .csv file.' });
  }

  if (!rows.length) return res.json({ applications: [], headers: [] });

  const headers = Object.keys(rows[0]);

  const applications = rows.map(row => ({
    company: pick(row, 'Company Name', 'Company', 'Employer'),
    job_title: pick(row, 'Job Title', 'Title', 'Position', 'Role'),
    application_link: pick(row, 'Job URL', 'URL', 'Link', 'Job Link'),
    application_date: parseLinkedInDate(pick(row, 'Application Date', 'Date Applied', 'Date', 'Applied Date')),
    status: mapStatus(pick(row, 'Application Status', 'Status', 'State')),
    notes: pick(row, 'Notes', 'Note', 'Comments'),
    recruiter_name: pick(row, 'Contact Name', 'Recruiter', 'Recruiter Name', 'Hiring Manager'),
    recruiter_email: pick(row, 'Contact Email', 'Recruiter Email', 'Email'),
    source: 'LinkedIn',
    priority: 'medium',
  })).filter(a => a.company || a.job_title); // drop blank rows

  res.json({ applications, headers, total: applications.length });
});

// ── POST /api/import/confirm ─────────────────────────────────────────────────
// Insert the (optionally modified) list

router.post('/confirm', (req, res) => {
  const { applications } = req.body;
  if (!Array.isArray(applications) || !applications.length) {
    return res.status(400).json({ error: 'No applications provided' });
  }

  const insertApp = db.prepare(`
    INSERT INTO applications (
      company, job_title, application_link, job_description, location,
      salary_range, application_date, status, source, resume_version_id,
      cover_letter, recruiter_name, recruiter_email, follow_up_date,
      interview_date, notes, priority, compensation_notes, referral_used, rejection_reason
    ) VALUES (?, ?, ?, '', '', '', ?, ?, ?, NULL, '', ?, ?, NULL, NULL, ?, ?, '', 0, '')
  `);

  const insertHistory = db.prepare(
    'INSERT INTO status_history (application_id, status, notes) VALUES (?, ?, ?)'
  );

  let imported = 0;
  let skipped = 0;

  const doImport = db.transaction(() => {
    for (const app of applications) {
      if (!app.company && !app.job_title) { skipped++; continue; }
      try {
        const result = insertApp.run(
          app.company || '',
          app.job_title || '',
          app.application_link || '',
          app.application_date || new Date().toISOString().split('T')[0],
          app.status || 'Applied',
          app.source || 'LinkedIn',
          app.recruiter_name || '',
          app.recruiter_email || '',
          app.notes || '',
          app.priority || 'medium'
        );
        insertHistory.run(result.lastInsertRowid, app.status || 'Applied', 'Imported from LinkedIn');
        imported++;
      } catch (err) {
        console.error('Import row error:', err.message);
        skipped++;
      }
    }
  });

  doImport();
  res.json({ imported, skipped });
});

// ── LinkedIn Connections import ──────────────────────────────────────────────

function extractConnections(buffer) {
  const zip = new AdmZip(buffer);
  const entry = zip.getEntries().find(e => {
    const n = e.entryName.toLowerCase();
    return n.endsWith('connections.csv');
  });
  if (!entry) return { rows: null };
  const text = entry.getData().toString('utf8');
  return { rows: parseConnectionsCSV(text) };
}

function parseConnectionsCSV(text) {
  // LinkedIn Connections.csv has a few preamble lines before the actual header
  // Skip lines until we find one that starts with "First Name"
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let headerIdx = lines.findIndex(l => l.toLowerCase().startsWith('first name'));
  if (headerIdx === -1) headerIdx = 0; // fallback

  const dataLines = lines.slice(headerIdx);
  const headers = splitCSVLine(dataLines[0]).map(h => h.trim().replace(/^\uFEFF/, ''));
  const rows = [];
  for (let i = 1; i < dataLines.length; i++) {
    if (!dataLines[i].trim()) continue;
    const vals = splitCSVLine(dataLines[i]);
    const row = {};
    headers.forEach((h, j) => { row[h] = (vals[j] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function mapContact(row) {
  return {
    first_name: pick(row, 'First Name'),
    last_name: pick(row, 'Last Name'),
    email: pick(row, 'Email Address', 'Email'),
    company: pick(row, 'Company', 'Employer'),
    position: pick(row, 'Position', 'Title', 'Role'),
    connected_on: pick(row, 'Connected On', 'Connection Date', 'Date'),
  };
}

// POST /api/import/connections-preview
router.post('/connections-preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { mimetype, originalname, buffer } = req.file;
  const isZip = mimetype === 'application/zip' ||
    mimetype === 'application/x-zip-compressed' ||
    originalname.toLowerCase().endsWith('.zip');
  const isCSV = mimetype === 'text/csv' || originalname.toLowerCase().endsWith('.csv');

  let rows;

  if (isZip) {
    const result = extractConnections(buffer);
    if (!result.rows) {
      return res.status(422).json({
        error: 'Could not find Connections.csv in the zip. Make sure you uploaded your full LinkedIn data archive.'
      });
    }
    rows = result.rows;
  } else if (isCSV) {
    rows = parseConnectionsCSV(buffer.toString('utf8'));
  } else {
    return res.status(400).json({ error: 'Please upload a .zip (LinkedIn archive) or .csv file.' });
  }

  if (!rows.length) return res.json({ contacts: [] });

  const contacts = rows.map(mapContact).filter(c => c.first_name || c.last_name || c.company);
  res.json({ contacts, total: contacts.length });
});

// POST /api/import/connections-confirm
router.post('/connections-confirm', (req, res) => {
  const { contacts } = req.body;
  if (!Array.isArray(contacts) || !contacts.length) {
    return res.status(400).json({ error: 'No contacts provided' });
  }

  const insert = db.prepare(`
    INSERT INTO contacts (first_name, last_name, email, company, position, connected_on)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skipped = 0;

  db.transaction(() => {
    for (const c of contacts) {
      if (!c.first_name && !c.last_name && !c.company) { skipped++; continue; }
      try {
        insert.run(c.first_name || '', c.last_name || '', c.email || '', c.company || '', c.position || '', c.connected_on || '');
        imported++;
      } catch (err) {
        console.error('Contact import error:', err.message);
        skipped++;
      }
    }
  })();

  res.json({ imported, skipped });
});

module.exports = router;
