const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/contacts — list with search + filter
router.get('/', (req, res) => {
  const { search = '', company = '', page = '1', limit = '5000' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = '1=1';
  const params = [];

  if (search) {
    where += ' AND (c.first_name || " " || c.last_name LIKE ? OR c.company LIKE ? OR c.position LIKE ? OR c.email LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  if (company) {
    where += ' AND c.company = ?';
    params.push(company);
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM contacts c WHERE ${where}`).get(...params).n;

  const contacts = db.prepare(`
    SELECT c.*,
      a.company as linked_company, a.job_title as linked_job_title, a.status as linked_status
    FROM contacts c
    LEFT JOIN applications a ON c.application_id = a.id
    WHERE ${where}
    ORDER BY c.first_name ASC, c.last_name ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  // Fetch applied companies + their most recent app id for warm intro linking
  const appliedApps = db.prepare(
    "SELECT id, lower(trim(company)) as co FROM applications WHERE company != '' ORDER BY application_date DESC"
  ).all();
  const appliedCompanies = [...new Set(appliedApps.map(a => a.co))];
  const appByCompany = {};
  appliedApps.forEach(a => { if (!appByCompany[a.co]) appByCompany[a.co] = a.id; });

  res.json({
    contacts: contacts.map(c => {
      const co = c.company?.toLowerCase().trim() ?? '';
      return {
        ...c,
        at_applied_company: appliedCompanies.includes(co),
        matched_app_id: appByCompany[co] ?? null
      };
    }),
    total
  });
});

// GET /api/contacts/stats
router.get('/stats', (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) as n FROM contacts').get().n;
  const linked = db.prepare('SELECT COUNT(*) as n FROM contacts WHERE application_id IS NOT NULL').get().n;
  const companies = db.prepare("SELECT COUNT(DISTINCT company) as n FROM contacts WHERE company != ''").get().n;

  const appliedCompanies = db.prepare(
    "SELECT DISTINCT lower(trim(company)) as co FROM applications WHERE company != ''"
  ).all().map(r => r.co);

  const atAppliedCompanies = db.prepare(
    "SELECT COUNT(*) as n FROM contacts WHERE lower(trim(company)) IN (SELECT lower(trim(company)) FROM applications WHERE company != '')"
  ).get().n;

  res.json({ total, linked, companies, atAppliedCompanies });
});

// GET /api/contacts/companies — distinct company list for filter
router.get('/companies', (_req, res) => {
  const rows = db.prepare(
    "SELECT DISTINCT company FROM contacts WHERE company != '' ORDER BY company ASC"
  ).all();
  res.json(rows.map(r => r.company));
});

// PUT /api/contacts/:id — update notes and/or application link
router.put('/:id', (req, res) => {
  const { notes, application_id } = req.body;
  const { id } = req.params;

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  if (!contact) return res.status(404).json({ error: 'Not found' });

  db.prepare(`
    UPDATE contacts SET
      notes = COALESCE(?, notes),
      application_id = ?
    WHERE id = ?
  `).run(notes ?? contact.notes, application_id ?? null, id);

  res.json(db.prepare('SELECT * FROM contacts WHERE id = ?').get(id));
});

// DELETE /api/contacts/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/contacts — wipe all (for re-import)
router.delete('/', (_req, res) => {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM contacts').get();
  db.prepare('DELETE FROM contacts').run();
  res.json({ deleted: count });
});

module.exports = router;
