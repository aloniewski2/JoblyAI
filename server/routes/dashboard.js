const express = require('express');
const router = express.Router();
const db = require('../db');
const { calcStreak } = require('../lib/ai');

// GET /api/dashboard
router.get('/', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const total = db.prepare('SELECT COUNT(*) as c FROM applications').get().c;
  const thisWeek = db.prepare('SELECT COUNT(*) as c FROM applications WHERE application_date >= ?').get(weekAgo).c;
  const offers = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'Offer'").get().c;
  const rejections = db.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'Rejected'").get().c;

  const interviews = db.prepare(`
    SELECT COUNT(*) as c FROM applications
    WHERE status IN ('Interview Round 1', 'Interview Round 2', 'Final Round', 'Recruiter Screen')
  `).get().c;

  const followUpsDue = db.prepare(`
    SELECT COUNT(*) as c FROM follow_ups
    WHERE completed = 0 AND due_date <= ?
  `).get(today).c;

  const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as count FROM applications GROUP BY status ORDER BY count DESC
  `).all();

  const bySource = db.prepare(`
    SELECT source, COUNT(*) as count FROM applications
    WHERE source != '' GROUP BY source ORDER BY count DESC LIMIT 8
  `).all();

  const byLocation = db.prepare(`
    SELECT location, COUNT(*) as count FROM applications
    WHERE location != '' GROUP BY location ORDER BY count DESC LIMIT 8
  `).all();

  const recentActivity = db.prepare(`
    SELECT sh.*, a.company, a.job_title
    FROM status_history sh
    JOIN applications a ON sh.application_id = a.id
    ORDER BY sh.created_at DESC LIMIT 15
  `).all();

  const noResponseAlert = db.prepare(`
    SELECT id, company, job_title, application_date, status,
      CAST((julianday('now') - julianday(application_date)) AS INTEGER) as days_since
    FROM applications
    WHERE status = 'Applied'
    AND application_date <= date('now', '-7 days')
    ORDER BY application_date ASC
    LIMIT 10
  `).all();

  const upcomingInterviews = db.prepare(`
    SELECT id, company, job_title, interview_date, status
    FROM applications
    WHERE interview_date >= date('now')
    ORDER BY interview_date ASC LIMIT 5
  `).all();

  const appDates = db.prepare(
    'SELECT DISTINCT date(application_date) as day FROM applications ORDER BY day DESC'
  ).all().map(r => r.day);
  const streak = calcStreak(appDates);

  const appsThisWeekCount = db.prepare(`
    SELECT date(application_date) as day, COUNT(*) as count
    FROM applications
    WHERE application_date >= date('now', '-13 days')
    GROUP BY day ORDER BY day ASC
  `).all();

  res.json({
    stats: { total, thisWeek, offers, rejections, interviews, followUpsDue, streak },
    statusBreakdown,
    bySource,
    byLocation,
    recentActivity,
    noResponseAlert,
    upcomingInterviews,
    appsThisWeekCount
  });
});

// GET /api/dashboard/analytics
router.get('/analytics', (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM applications').get().c;

  const applied = db.prepare(`
    SELECT COUNT(DISTINCT application_id) as c FROM status_history
    WHERE status NOT IN ('Interested', 'Planning to Apply', 'On Hold')
  `).get().c;

  const screened = db.prepare(`
    SELECT COUNT(DISTINCT application_id) as c FROM status_history
    WHERE status = 'Recruiter Screen'
  `).get().c;

  const interviewed = db.prepare(`
    SELECT COUNT(DISTINCT application_id) as c FROM status_history
    WHERE status IN ('Interview Round 1', 'Interview Round 2', 'Final Round')
  `).get().c;

  const offered = db.prepare(`
    SELECT COUNT(DISTINCT application_id) as c FROM status_history
    WHERE status = 'Offer'
  `).get().c;

  const bySource = db.prepare(`
    SELECT
      source,
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('Recruiter Screen','Interview Round 1','Interview Round 2','Final Round','Offer') THEN 1 ELSE 0 END) as reached_interview,
      SUM(CASE WHEN status = 'Offer' THEN 1 ELSE 0 END) as offers,
      SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected
    FROM applications
    WHERE source != ''
    GROUP BY source
    ORDER BY total DESC
    LIMIT 10
  `).all();

  const avgRow = db.prepare(`
    SELECT AVG(CAST(julianday(sh2.created_at) - julianday(sh1.created_at) AS INTEGER)) as avg_days
    FROM status_history sh1
    JOIN (
      SELECT application_id, MIN(created_at) as created_at
      FROM status_history
      WHERE status IN ('Recruiter Screen', 'Interview Round 1')
      GROUP BY application_id
    ) sh2 ON sh1.application_id = sh2.application_id
    WHERE sh1.status = 'Applied' AND sh2.created_at > sh1.created_at
  `).get();

  const weeklyVolume = db.prepare(`
    SELECT strftime('%Y-W%W', application_date) as week, COUNT(*) as count
    FROM applications
    WHERE application_date >= date('now', '-84 days')
    GROUP BY week ORDER BY week ASC
  `).all();

  const statusBreakdown = db.prepare(
    'SELECT status, COUNT(*) as count FROM applications GROUP BY status ORDER BY count DESC'
  ).all();

  res.json({
    funnel: { total, applied, screened, interviewed, offered },
    bySource,
    weeklyVolume,
    statusBreakdown,
    avgDaysToInterview: avgRow?.avg_days ? Math.round(avgRow.avg_days) : null
  });
});

// GET /api/today
router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const followUpsDue = db.prepare(`
    SELECT fu.*, a.company, a.job_title, a.status
    FROM follow_ups fu
    JOIN applications a ON fu.application_id = a.id
    WHERE fu.completed = 0 AND fu.due_date <= ?
    ORDER BY fu.due_date ASC LIMIT 20
  `).all(today);

  const upcomingInterviews = db.prepare(`
    SELECT id, company, job_title, interview_date, status, recruiter_name
    FROM applications
    WHERE interview_date >= ? AND interview_date <= date(?, '+3 days')
    ORDER BY interview_date ASC
  `).all(today, today);

  const noResponse7 = db.prepare(`
    SELECT id, company, job_title, application_date, status,
      CAST((julianday('now') - julianday(application_date)) AS INTEGER) as days_since
    FROM applications
    WHERE status = 'Applied' AND application_date <= date('now', '-7 days')
    ORDER BY application_date ASC
  `).all();

  const recentEmails = db.prepare(`
    SELECT ea.*, a.company, a.job_title
    FROM email_activities ea
    LEFT JOIN applications a ON ea.application_id = a.id
    ORDER BY ea.received_at DESC LIMIT 10
  `).all();

  res.json({ followUpsDue, upcomingInterviews, noResponse7, recentEmails });
});

module.exports = router;
