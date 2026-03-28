const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

async function extractResumeText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === '.pdf') {
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: fs.readFileSync(filePath) });
      const result = await parser.getText();
      return result.text || '';
    } else if (ext === '.docx') {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    }
  } catch (e) {
    console.error('Text extraction failed:', e.message);
  }
  return '';
}

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// GET /api/resumes
router.get('/', (req, res) => {
  const resumes = db.prepare('SELECT * FROM resumes ORDER BY is_master DESC, created_at DESC').all();
  res.json(resumes.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]'), hasText: !!(r.resume_text) })));
});

// POST /api/resumes
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { name, tags = '[]', is_master = 0 } = req.body;

  if (parseInt(is_master) === 1) {
    db.prepare('UPDATE resumes SET is_master = 0').run();
  }

  const filePath = path.join(UPLOADS_DIR, req.file.filename);
  const resumeText = await extractResumeText(filePath);

  const result = db.prepare(`
    INSERT INTO resumes (name, filename, original_name, tags, file_size, is_master, resume_text)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    name || req.file.originalname,
    req.file.filename,
    req.file.originalname,
    typeof tags === 'string' ? tags : JSON.stringify(tags),
    req.file.size,
    parseInt(is_master) || 0,
    resumeText
  );

  const resume = db.prepare('SELECT * FROM resumes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...resume, tags: JSON.parse(resume.tags || '[]'), hasText: !!(resume.resume_text) });
});

// POST /api/resumes/:id/extract-text — re-extract text for an existing resume
router.post('/:id/extract-text', async (req, res) => {
  const resume = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
  if (!resume) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(UPLOADS_DIR, resume.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  const resumeText = await extractResumeText(filePath);
  db.prepare('UPDATE resumes SET resume_text = ? WHERE id = ?').run(resumeText, req.params.id);

  res.json({ success: true, hasText: !!resumeText, length: resumeText.length });
});

// PUT /api/resumes/:id
router.put('/:id', (req, res) => {
  const { name, tags, is_master } = req.body;
  const resume = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
  if (!resume) return res.status(404).json({ error: 'Not found' });

  if (parseInt(is_master) === 1) {
    db.prepare('UPDATE resumes SET is_master = 0').run();
  }

  db.prepare(`UPDATE resumes SET name=?, tags=?, is_master=? WHERE id=?`).run(
    name || resume.name,
    typeof tags === 'string' ? tags : JSON.stringify(tags || []),
    parseInt(is_master) || 0,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
  res.json({ ...updated, tags: JSON.parse(updated.tags || '[]') });
});

// GET /api/resumes/:id/download
router.get('/:id/download', (req, res) => {
  const resume = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
  if (!resume) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(UPLOADS_DIR, resume.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.download(filePath, resume.original_name);
});

// GET /api/resumes/:id/view — serve inline for in-browser preview
router.get('/:id/view', (req, res) => {
  const resume = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
  if (!resume) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(UPLOADS_DIR, resume.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  const ext = path.extname(resume.filename).toLowerCase();
  const contentType = ext === '.pdf' ? 'application/pdf'
    : ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/msword';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${resume.original_name}"`);
  fs.createReadStream(filePath).pipe(res);
});

// DELETE /api/resumes/:id
router.delete('/:id', (req, res) => {
  const resume = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
  if (!resume) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(UPLOADS_DIR, resume.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('UPDATE applications SET resume_version_id = NULL WHERE resume_version_id = ?').run(req.params.id);
  db.prepare('DELETE FROM resumes WHERE id = ?').run(req.params.id);

  res.json({ success: true });
});

module.exports = router;
