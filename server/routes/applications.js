const express = require('express');
const router = express.Router();
const db = require('../db');
const { getAIClient } = require('../lib/ai');

const INTERVIEW_STATUSES = new Set(['Recruiter Screen', 'Interview Round 1', 'Interview Round 2', 'Final Round']);

const VALID_STATUSES = [
  'Interested', 'Planning to Apply', 'Applied', 'Recruiter Screen',
  'Interview Round 1', 'Interview Round 2', 'Final Round',
  'Offer', 'Rejected', 'Withdrawn', 'On Hold'
];

// GET /api/applications
router.get('/', (req, res) => {
  const { status, source, priority, search, sort = 'updated_at', order = 'DESC', limit = 200, offset = 0 } = req.query;

  let where = [];
  let params = [];

  if (status && status !== 'all') {
    const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
    where.push(`a.status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }
  if (source) {
    where.push('a.source = ?');
    params.push(source);
  }
  if (priority) {
    where.push('a.priority = ?');
    params.push(priority);
  }
  if (search) {
    where.push('(a.company LIKE ? OR a.job_title LIKE ? OR a.location LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const allowedSorts = ['updated_at', 'created_at', 'application_date', 'company', 'priority', 'status'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'updated_at';
  const orderDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const rows = db.prepare(`
    SELECT a.*, r.name as resume_name
    FROM applications a
    LEFT JOIN resumes r ON a.resume_version_id = r.id
    ${whereClause}
    ORDER BY a.${sortCol} ${orderDir}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  const total = db.prepare(`SELECT COUNT(*) as count FROM applications a ${whereClause}`).get(...params);

  res.json({ applications: rows.map(parseApp), total: total.count });
});

// GET /api/applications/export — download all applications as CSV
router.get('/export', (_req, res) => {
  const rows = db.prepare('SELECT * FROM applications ORDER BY application_date DESC').all();
  const cols = [
    'id', 'company', 'job_title', 'status', 'priority', 'location',
    'salary_range', 'application_date', 'source', 'recruiter_name', 'recruiter_email',
    'follow_up_date', 'interview_date', 'notes', 'application_link'
  ];
  const esc = v => {
    if (v == null) return '';
    const s = String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="joblyai-applications.csv"');
  res.send(csv);
});

// GET /api/applications/:id
router.get('/:id', (req, res) => {
  const app = db.prepare(`
    SELECT a.*, r.name as resume_name
    FROM applications a
    LEFT JOIN resumes r ON a.resume_version_id = r.id
    WHERE a.id = ?
  `).get(req.params.id);

  if (!app) return res.status(404).json({ error: 'Not found' });
  res.json(parseApp(app));
});

// POST /api/applications
router.post('/', (req, res) => {
  const fields = extractFields(req.body);
  const result = db.prepare(`
    INSERT INTO applications (
      company, job_title, application_link, job_description, location,
      salary_range, application_date, status, source, resume_version_id,
      cover_letter, recruiter_name, recruiter_email, follow_up_date,
      interview_date, notes, priority, compensation_notes, referral_used, rejection_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(...fields);

  db.prepare(`INSERT INTO status_history (application_id, status) VALUES (?, ?)`).run(result.lastInsertRowid, req.body.status || 'Interested');

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseApp(app));
});

// PUT /api/applications/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const fields = extractFields(req.body);
  db.prepare(`
    UPDATE applications SET
      company=?, job_title=?, application_link=?, job_description=?, location=?,
      salary_range=?, application_date=?, status=?, source=?, resume_version_id=?,
      cover_letter=?, recruiter_name=?, recruiter_email=?, follow_up_date=?,
      interview_date=?, notes=?, priority=?, compensation_notes=?, referral_used=?,
      rejection_reason=?, updated_at=datetime('now')
    WHERE id=?
  `).run(...fields, req.params.id);

  if (req.body.status && req.body.status !== existing.status) {
    db.prepare(`INSERT INTO status_history (application_id, status, notes) VALUES (?, ?, ?)`).run(
      req.params.id, req.body.status, req.body.statusNote || ''
    );
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  res.json(parseApp(app));
});

// DELETE /api/applications — delete all
router.delete('/', (_req, res) => {
  const result = db.prepare('DELETE FROM applications').run();
  res.json({ success: true, deleted: result.changes });
});

// DELETE /api/applications/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM applications WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// POST /api/applications/:id/status — update status only
router.post('/:id/status', async (req, res) => {
  const { status, notes = '' } = req.body;
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Not found' });

  db.prepare(`UPDATE applications SET status=?, updated_at=datetime('now') WHERE id=?`).run(status, req.params.id);
  db.prepare(`INSERT INTO status_history (application_id, status, notes) VALUES (?, ?, ?)`).run(req.params.id, status, notes);

  // Auto-generate interview prep when moving into an interview stage
  let interview_prep = null;
  if (INTERVIEW_STATUSES.has(status) && app.job_description) {
    try {
      const ai = getAIClient();
      if (ai) {
        const prompt = `Generate a focused interview preparation guide for "${app.job_title}" at "${app.company}" (${status}).

Based on the job description below, provide:
1. 5 likely behavioral questions with STAR framework hints
2. 3 technical/case topics to prepare
3. 3 smart questions to ask the interviewer
4. Key themes and values to emphasize

Job description: ${app.job_description.slice(0, 3000)}`;

        const response = await ai.client.chat.completions.create({
          model: ai.smartModel,
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }]
        });
        interview_prep = response.choices[0].message.content;
      }
    } catch (err) {
      console.error('Auto interview prep error:', err.message);
    }
  }

  res.json({ success: true, status, interview_prep });
});

// GET /api/applications/:id/status-history
router.get('/:id/status-history', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM status_history WHERE application_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);
  res.json(rows);
});

// GET /api/applications/:id/emails
router.get('/:id/emails', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM email_activities WHERE application_id = ? ORDER BY received_at DESC'
  ).all(req.params.id);
  res.json(rows);
});

// POST /api/applications/:id/followup
router.post('/:id/followup', (req, res) => {
  const { due_date, notes = '' } = req.body;
  const result = db.prepare(
    'INSERT INTO follow_ups (application_id, due_date, notes) VALUES (?, ?, ?)'
  ).run(req.params.id, due_date, notes);
  res.status(201).json({ id: result.lastInsertRowid });
});

// PATCH /api/applications/followup/:followupId
router.patch('/followup/:followupId', (req, res) => {
  const { completed } = req.body;
  db.prepare('UPDATE follow_ups SET completed=? WHERE id=?').run(completed ? 1 : 0, req.params.followupId);
  res.json({ success: true });
});

// GET /api/applications/:id/connections — contacts at the same company
router.get('/:id/connections', (req, res) => {
  const app = db.prepare('SELECT company FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Not found' });
  const co = app.company.trim().toLowerCase();
  const rows = db.prepare(`
    SELECT * FROM contacts
    WHERE LOWER(TRIM(company)) = ?
       OR LOWER(TRIM(company)) LIKE '%' || ? || '%'
    ORDER BY first_name ASC
  `).all(co, co);
  res.json(rows);
});

// GET /api/applications/:id/questions
router.get('/:id/questions', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM interview_questions WHERE application_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);
  res.json(rows);
});

// POST /api/applications/:id/questions
router.post('/:id/questions', (req, res) => {
  const { round = '', question, answer = '' } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'Question required' });
  const result = db.prepare(
    'INSERT INTO interview_questions (application_id, round, question, answer) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, round, question.trim(), answer.trim());
  res.status(201).json(db.prepare('SELECT * FROM interview_questions WHERE id = ?').get(result.lastInsertRowid));
});

// PATCH /api/applications/:id/questions/:qid
router.patch('/:id/questions/:qid', (req, res) => {
  const { answer } = req.body;
  db.prepare('UPDATE interview_questions SET answer=? WHERE id=? AND application_id=?')
    .run(answer ?? '', req.params.qid, req.params.id);
  res.json(db.prepare('SELECT * FROM interview_questions WHERE id=?').get(req.params.qid));
});

// DELETE /api/applications/:id/questions/:qid
router.delete('/:id/questions/:qid', (req, res) => {
  db.prepare('DELETE FROM interview_questions WHERE id=? AND application_id=?')
    .run(req.params.qid, req.params.id);
  res.json({ success: true });
});

function extractFields(body) {
  return [
    body.company || '', body.job_title || '', body.application_link || '',
    body.job_description || '', body.location || '', body.salary_range || '',
    body.application_date || new Date().toISOString().split('T')[0],
    body.status || 'Interested', body.source || '',
    body.resume_version_id || null,
    body.cover_letter || '', body.recruiter_name || '', body.recruiter_email || '',
    body.follow_up_date || null, body.interview_date || null,
    body.notes || '', body.priority || 'medium', body.compensation_notes || '',
    body.referral_used ? 1 : 0, body.rejection_reason || ''
  ];
}

function parseApp(row) {
  return { ...row, referral_used: row.referral_used === 1 };
}

module.exports = router;
