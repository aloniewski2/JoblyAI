const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'jobly.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    file_size INTEGER DEFAULT 0,
    is_master INTEGER DEFAULT 0,
    resume_text TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    job_title TEXT NOT NULL DEFAULT '',
    application_link TEXT DEFAULT '',
    job_description TEXT DEFAULT '',
    location TEXT DEFAULT '',
    salary_range TEXT DEFAULT '',
    application_date TEXT DEFAULT (date('now')),
    status TEXT DEFAULT 'Interested',
    source TEXT DEFAULT '',
    resume_version_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL,
    cover_letter TEXT DEFAULT '',
    recruiter_name TEXT DEFAULT '',
    recruiter_email TEXT DEFAULT '',
    follow_up_date TEXT DEFAULT NULL,
    interview_date TEXT DEFAULT NULL,
    notes TEXT DEFAULT '',
    priority TEXT DEFAULT 'medium',
    compensation_notes TEXT DEFAULT '',
    referral_used INTEGER DEFAULT 0,
    rejection_reason TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
    gmail_message_id TEXT UNIQUE,
    subject TEXT DEFAULT '',
    sender TEXT DEFAULT '',
    sender_email TEXT DEFAULT '',
    body_preview TEXT DEFAULT '',
    classification TEXT DEFAULT 'unknown',
    received_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS follow_ups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    due_date TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    email TEXT DEFAULT '',
    company TEXT DEFAULT '',
    position TEXT DEFAULT '',
    connected_on TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interview_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    round TEXT DEFAULT '',
    question TEXT NOT NULL,
    answer TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Migrations — add columns to existing tables if they don't exist
const existingCols = db.prepare("PRAGMA table_info(resumes)").all().map(c => c.name);
if (!existingCols.includes('resume_text')) {
  db.exec("ALTER TABLE resumes ADD COLUMN resume_text TEXT DEFAULT ''");
}

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
insertSetting.run('gmail_enabled', 'false');
insertSetting.run('gmail_tokens', '');
insertSetting.run('gmail_last_sync', '');
insertSetting.run('auto_status_update', 'true');
insertSetting.run('anthropic_api_key', '');
insertSetting.run('groq_api_key', '');
insertSetting.run('ai_provider', 'ollama');
insertSetting.run('ollama_url', 'http://localhost:11434/v1');
insertSetting.run('ollama_model', 'llama3.2');

module.exports = db;
