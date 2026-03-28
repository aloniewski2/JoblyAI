const express = require('express');
const router = express.Router();
const db = require('../db');
const { getAIClient, calcStreak } = require('../lib/ai');

// POST /api/ai/extract — extract job info from pasted text or URL content
router.post('/extract', async (req, res) => {
  const { text, url } = req.body;
  const content = text || '';

  if (!content && !url) return res.json({ extracted: {} });

  const ai = getAIClient();
  if (!ai) {
    return res.json({
      extracted: {},
      warning: 'No AI provider configured. Add a Groq API key in Settings or start Ollama locally.'
    });
  }

  try {
    const prompt = `Extract job posting information from the following text. Return ONLY valid JSON with these fields:
{
  "company": "Company name",
  "job_title": "Job title",
  "location": "Location (city, state or remote)",
  "salary_range": "Salary range if mentioned",
  "job_description": "Full job description text"
}

If a field is not found, use an empty string. Here is the job posting text:

${content.slice(0, 8000)}`;

    const response = await ai.client.chat.completions.create({
      model: ai.fastModel,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.choices[0].message.content;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]);
      return res.json({ extracted });
    }
    res.json({ extracted: {} });
  } catch (err) {
    console.error('AI extract error:', err.message);
    res.json({ extracted: {}, warning: 'AI extraction failed. Fill in manually.' });
  }
});

// POST /api/ai/match — compare resume to job description
router.post('/match', async (req, res) => {
  let { resume_text, job_description, job_title, company, resume_id } = req.body;
  if (resume_id && !resume_text) {
    const stored = db.prepare('SELECT resume_text FROM resumes WHERE id = ?').get(resume_id);
    if (stored?.resume_text) resume_text = stored.resume_text;
  }

  const ai = getAIClient();
  if (!ai) return res.status(503).json({ error: 'No AI provider configured. Add a Groq API key in Settings or start Ollama locally.' });
  if (!job_description) return res.status(400).json({ error: 'Job description required' });

  try {
    const prompt = `You are an expert career coach and resume analyst. Analyze the following resume against the job description and provide a detailed match assessment.

Job: ${job_title || 'Unknown'} at ${company || 'Unknown'}

JOB DESCRIPTION:
${job_description.slice(0, 4000)}

RESUME:
${(resume_text || 'No resume text provided').slice(0, 4000)}

Respond with valid JSON in exactly this format:
{
  "fit_score": 85,
  "summary": "Brief 2-3 sentence overall assessment",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "gaps": ["gap 1", "gap 2"],
  "missing_keywords": ["keyword1", "keyword2", "keyword3"],
  "resume_improvements": [
    {"bullet": "Original bullet", "improved": "Improved version with stronger impact metrics"}
  ],
  "cover_letter_tips": "2-3 sentences on what to emphasize in a cover letter",
  "networking_message": "A 3-4 sentence LinkedIn outreach message for this role"
}`;

    const response = await ai.client.chat.completions.create({
      model: ai.smartModel,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.choices[0].message.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return res.json(JSON.parse(jsonMatch[0]));
    }
    res.json({ error: 'Could not parse AI response', raw: text });
  } catch (err) {
    console.error('AI match error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/chat — general AI assistant
router.post('/chat', async (req, res) => {
  const { message, context } = req.body;

  const ai = getAIClient();
  if (!ai) return res.status(503).json({ error: 'No AI provider configured. Add a Groq API key in Settings or start Ollama locally.' });

  try {
    const systemPrompt = `You are JoblyAI, a career assistant helping a job seeker who was recently laid off from EY (Ernst & Young). They have a background in consulting, financial services, risk, and strategy. Help them with job applications, interview prep, and career strategy.

${context ? `Current context: ${JSON.stringify(context)}` : ''}`;

    const response = await ai.client.chat.completions.create({
      model: ai.smartModel,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });

    res.json({ response: response.choices[0].message.content });
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/summarize — summarize a job description
router.post('/summarize', async (req, res) => {
  const { job_description, job_title, company } = req.body;

  const ai = getAIClient();
  if (!ai) return res.status(503).json({ error: 'No AI provider configured.' });

  try {
    const prompt = `Summarize this job posting for "${job_title}" at "${company}". Return exactly 4 bullet points using this format (one per line, starting with "- "):

- **Role level:** [seniority and type, e.g. "Senior IC, individual contributor on the data platform team"]
- **Key responsibilities:** [2-3 core duties, comma-separated]
- **Must-haves:** [the 2-3 non-negotiable qualifications]
- **Compensation:** [salary/equity if listed, otherwise "Not disclosed"]

Be direct and specific. No preamble.

${job_description.slice(0, 4000)}`;

    const response = await ai.client.chat.completions.create({
      model: ai.fastModel,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    res.json({ summary: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/interview-prep — generate interview prep topics
router.post('/interview-prep', async (req, res) => {
  const { job_title, company, job_description } = req.body;

  const ai = getAIClient();
  if (!ai) return res.status(503).json({ error: 'No AI provider configured.' });

  try {
    const prompt = `Generate an interview prep guide for "${job_title}" at "${company}".

Use exactly this structure with these headings:

## Behavioral Questions
1. [Question] — STAR hint: [one-sentence focus]
2. [Question] — STAR hint: [one-sentence focus]
3. [Question] — STAR hint: [one-sentence focus]
4. [Question] — STAR hint: [one-sentence focus]
5. [Question] — STAR hint: [one-sentence focus]

## Case / Technical Topics
- [Topic and what to prepare]
- [Topic and what to prepare]
- [Topic and what to prepare]

## Questions to Ask Them
- [Question]
- [Question]
- [Question]

## Key Themes to Emphasize
- [Theme from the JD that maps to your background]
- [Theme]
- [Theme]

Job description: ${(job_description || '').slice(0, 3000)}`;

    const response = await ai.client.chat.completions.create({
      model: ai.smartModel,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    res.json({ prep: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/daily-brief — AI-generated morning briefing
router.get('/daily-brief', async (_req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const followUpsDue = db.prepare(
    'SELECT COUNT(*) as c FROM follow_ups WHERE completed = 0 AND due_date <= ?'
  ).get(today).c;

  const upcomingInterviews = db.prepare(`
    SELECT company, job_title, interview_date, status
    FROM applications
    WHERE interview_date >= ? AND interview_date <= date(?, '+7 days')
    ORDER BY interview_date ASC LIMIT 5
  `).all(today, today);

  const staleApps = db.prepare(`
    SELECT company, job_title,
      CAST((julianday('now') - julianday(application_date)) AS INTEGER) as days_since
    FROM applications
    WHERE status = 'Applied' AND application_date <= date('now', '-7 days')
    ORDER BY application_date ASC LIMIT 5
  `).all();

  const totalActive = db.prepare(`
    SELECT COUNT(*) as c FROM applications
    WHERE status NOT IN ('Rejected', 'Withdrawn', 'Offer')
  `).get().c;

  const appDates = db.prepare(
    'SELECT DISTINCT date(application_date) as day FROM applications ORDER BY day DESC'
  ).all().map(r => r.day);
  const streak = calcStreak(appDates);

  const ai = getAIClient();
  if (!ai) return res.status(503).json({ error: 'No AI provider configured.' });

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  const prompt = `You are JoblyAI, a career assistant for Andrew, an ex-EY consultant now actively job searching in consulting, fintech, and strategy. Generate a brief morning briefing for ${todayFormatted}.

Current data:
- Active pipeline: ${totalActive} applications
- Application streak: ${streak} consecutive day${streak !== 1 ? 's' : ''}
- Follow-ups due today: ${followUpsDue}
- Upcoming interviews (next 7 days): ${upcomingInterviews.length > 0 ? upcomingInterviews.map(i => `${i.company} — ${i.job_title} on ${i.interview_date}`).join('; ') : 'none scheduled'}
- Applications needing follow-up (7+ days no response): ${staleApps.length > 0 ? staleApps.map(a => `${a.company} (${a.days_since}d)`).join(', ') : 'none'}

Write 2-3 sentences: acknowledge the current momentum, flag today's most important action, and close with a brief motivational note relevant to this job search stage. Be direct and personal. No emojis. No bullet points.`;

  try {
    const response = await ai.client.chat.completions.create({
      model: ai.fastModel,
      max_tokens: 250,
      messages: [{ role: 'user', content: prompt }]
    });

    res.json({
      brief: response.choices[0].message.content,
      meta: { followUpsDue, interviews: upcomingInterviews.length, staleApps: staleApps.length, streak, totalActive }
    });
  } catch (err) {
    console.error('Daily brief error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/followup-suggestions — generate follow-up email drafts for stale apps
router.post('/followup-suggestions', async (req, res) => {
  const { app_ids } = req.body;
  if (!app_ids?.length) return res.json({ suggestions: [] });

  const ai = getAIClient();
  if (!ai) return res.status(503).json({ error: 'No AI provider configured.' });

  const placeholders = app_ids.slice(0, 5).map(() => '?').join(',');
  const apps = db.prepare(`
    SELECT id, company, job_title, recruiter_name, recruiter_email, application_date,
      CAST((julianday('now') - julianday(application_date)) AS INTEGER) as days_since
    FROM applications
    WHERE id IN (${placeholders})
  `).all(...app_ids.slice(0, 5));

  if (!apps.length) return res.json({ suggestions: [] });

  const prompt = `You are a career advisor helping Andrew, an ex-EY consultant (consulting, fintech, strategy background), follow up on job applications.

Write a brief, professional follow-up email for each application below. Each email should be 3-4 sentences: reference the role, express continued interest, mention one relevant strength, and ask about next steps.

Applications:
${apps.map(a => `- ID ${a.id}: ${a.company} — ${a.job_title}, applied ${a.days_since} days ago${a.recruiter_name ? `, contact: ${a.recruiter_name}` : ''}`).join('\n')}

Return ONLY valid JSON:
{
  "suggestions": [
    {
      "app_id": 1,
      "subject": "Following Up — Job Title at Company",
      "body": "Dear Hiring Team,\\n\\n..."
    }
  ]
}`;

  try {
    const response = await ai.client.chat.completions.create({
      model: ai.fastModel,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.choices[0].message.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const suggestions = parsed.suggestions.map(s => {
        const app = apps.find(a => a.id === s.app_id);
        return { ...s, company: app?.company, job_title: app?.job_title, recruiter_email: app?.recruiter_email };
      });
      return res.json({ suggestions });
    }
    res.json({ suggestions: [] });
  } catch (err) {
    console.error('Followup suggestions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/intake — extract + auto-match against master resume → apply recommendation
router.post('/intake', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });

  const ai = getAIClient();
  if (!ai) return res.status(503).json({ error: 'No AI provider configured.' });

  // Step 1: Extract job info
  let extracted = {};
  try {
    const extractResponse = await ai.client.chat.completions.create({
      model: ai.fastModel,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract job posting information from the following text. Return ONLY valid JSON with these fields:
{
  "company": "Company name",
  "job_title": "Job title",
  "location": "Location (city, state or remote)",
  "salary_range": "Salary range if mentioned",
  "job_description": "Full job description text"
}
If a field is not found, use an empty string.

${text.slice(0, 8000)}`
      }]
    });
    const extractText = extractResponse.choices[0].message.content;
    const jsonMatch = extractText.match(/\{[\s\S]*\}/);
    if (jsonMatch) extracted = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('Intake extract error:', err.message);
  }

  // Step 2: Match against candidate profile (master resume context)
  const masterResume = db.prepare('SELECT * FROM resumes WHERE is_master = 1 LIMIT 1').get();
  let match = null;

  if (extracted.job_description) {
    try {
      const matchResponse = await ai.client.chat.completions.create({
        model: ai.smartModel,
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `You are a career coach evaluating a job opportunity for Andrew, an ex-EY consultant.

Candidate background: consulting, financial services, risk management, strategy, data analytics, process improvement, stakeholder management, client delivery. ${masterResume ? `Resume on file: "${masterResume.name}".` : ''}

Job: ${extracted.job_title || 'Unknown'} at ${extracted.company || 'Unknown'}
Location: ${extracted.location || 'Unknown'}
Salary: ${extracted.salary_range || 'Not listed'}

JOB DESCRIPTION:
${(extracted.job_description || '').slice(0, 3000)}

Respond with valid JSON:
{
  "fit_score": 85,
  "recommendation": "Apply",
  "recommendation_reason": "One sentence why",
  "summary": "2 sentence assessment",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "gaps": ["gap 1"],
  "apply_tip": "One sentence on how to position yourself for this role"
}

recommendation must be one of: "Apply", "Consider", "Skip"`
        }]
      });
      const matchText = matchResponse.choices[0].message.content;
      const matchJson = matchText.match(/\{[\s\S]*\}/);
      if (matchJson) match = JSON.parse(matchJson[0]);
    } catch (err) {
      console.error('Intake match error:', err.message);
    }
  }

  res.json({ extracted, match, hasResume: !!masterResume });
});

// POST /api/ai/cover-letter — generate a tailored cover letter for an application
router.post('/cover-letter', async (req, res) => {
  const { app_id, tone } = req.body;
  if (!app_id) return res.status(400).json({ error: 'app_id required' });

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(app_id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const masterResume = db.prepare('SELECT * FROM resumes WHERE is_master = 1 LIMIT 1').get()
    || db.prepare('SELECT * FROM resumes ORDER BY created_at DESC LIMIT 1').get();

  const ai = getAIClient();
  if (!ai) return res.status(503).json({ error: 'No AI provider configured.' });

  const toneMap = {
    enthusiastic: 'warm and enthusiastic',
    concise: 'brief and direct (3 paragraphs max)',
    professional: 'professional and confident'
  };
  const toneStr = toneMap[tone] || toneMap.professional;

  const resumeContext = masterResume?.resume_text
    ? `\nRESUME:\n${masterResume.resume_text.slice(0, 3000)}`
    : masterResume ? `\nResume on file: "${masterResume.name}"` : '';

  const prompt = `Write a ${toneStr} cover letter for Andrew, an ex-EY consultant with expertise in consulting, financial services, risk management, strategy, and data analytics.

Role: ${app.job_title} at ${app.company}${app.location ? ` — ${app.location}` : ''}
${resumeContext}

JOB DESCRIPTION:
${(app.job_description || 'Not provided').slice(0, 3000)}

Format requirements:
- Opening: "Dear Hiring Team," (unless a specific name is in the JD)
- Paragraph 1: Compelling hook — why this role at this company specifically
- Paragraph 2: Relevant EY/consulting experience mapped to the role's core needs
- Paragraph 3: One concrete example or result that proves fit
- Paragraph 4: Brief closing with clear call to action
- Sign-off: "Best regards,\n[Your Name]"

Separate each paragraph with a blank line. Write only the letter — no subject line, no commentary.`;

  try {
    const response = await ai.client.chat.completions.create({
      model: ai.smartModel,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ cover_letter: response.choices[0].message.content });
  } catch (err) {
    console.error('Cover letter error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/compare-offers — side-by-side AI analysis of multiple offers
router.post('/compare-offers', async (req, res) => {
  const { app_ids } = req.body;
  if (!Array.isArray(app_ids) || app_ids.length < 2) {
    return res.status(400).json({ error: 'At least 2 app_ids required' });
  }

  const placeholders = app_ids.slice(0, 5).map(() => '?').join(',');
  const apps = db.prepare(`SELECT * FROM applications WHERE id IN (${placeholders})`).all(...app_ids.slice(0, 5));

  if (apps.length < 2) return res.status(400).json({ error: 'Could not find enough applications' });

  const ai = getAIClient();
  if (!ai) return res.status(503).json({ error: 'No AI provider configured.' });

  const prompt = `You are a senior career advisor comparing job offers for Andrew, an ex-EY consultant (consulting, fintech, strategy background) actively making a career pivot decision.

OFFERS TO COMPARE:
${apps.map((a, i) => `Offer ${i + 1}: ${a.job_title} at ${a.company}
Location: ${a.location || 'Not specified'} | Salary: ${a.salary_range || 'Not disclosed'}
Notes: ${a.notes || 'None'}
${a.job_description ? `Description: ${a.job_description.slice(0, 800)}` : ''}`).join('\n\n---\n\n')}

Respond with valid JSON only:
{
  "recommendation": "Exact company name",
  "recommendation_reason": "2-3 sentences explaining the top pick",
  "overall_summary": "2-3 sentences on the comparative landscape",
  "offers": [
    {
      "app_id": 0,
      "company": "",
      "job_title": "",
      "pros": ["pro 1", "pro 2", "pro 3"],
      "cons": ["con 1", "con 2"],
      "comp_score": 0,
      "growth_score": 0,
      "fit_score": 0,
      "verdict": "One sentence verdict"
    }
  ],
  "negotiation_tip": "One specific negotiation move for the recommended offer"
}

app_id values must match exactly: ${apps.map(a => a.id).join(', ')}`;

  try {
    const response = await ai.client.chat.completions.create({
      model: ai.smartModel,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });
    const text = response.choices[0].message.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return res.json(JSON.parse(jsonMatch[0]));
    res.status(500).json({ error: 'Could not parse AI response' });
  } catch (err) {
    console.error('Compare offers error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/warm-intro — draft a LinkedIn DM to a connection at a target company
router.post('/warm-intro', async (req, res) => {
  const { app_id, contact_id } = req.body;
  if (!app_id || !contact_id) return res.status(400).json({ error: 'app_id and contact_id required' });

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(app_id);
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contact_id);
  if (!app || !contact) return res.status(404).json({ error: 'Not found' });

  const ai = getAIClient();
  if (!ai) return res.status(503).json({ error: 'No AI provider configured.' });

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'there';

  const prompt = `Write a warm LinkedIn message from Andrew (ex-EY consultant) to ${name}, who works as "${contact.position || 'a colleague'}" at ${contact.company}. Andrew is exploring the ${app.job_title} role there.

Output in exactly this format with blank lines between each part:

Hi ${name},

[1–2 sentences: warm opener referencing their specific role at ${contact.company} — shows genuine interest, not mass outreach]

[1–2 sentences: mention you're exploring the ${app.job_title} role and would love their honest take on the team or culture — soft ask only, no referral request]

No pressure at all — happy either way!

Andrew

Write only the message text, exactly as it should be sent. Natural tone, peer-to-peer, 4–6 sentences total.`;

  try {
    const response = await ai.client.chat.completions.create({
      model: ai.fastModel,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({
      message: response.choices[0].message.content.trim(),
      contact_name: name,
      contact_email: contact.email || ''
    });
  } catch (err) {
    console.error('Warm intro error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/tailor-resume — rewrite resume bullets to target a specific job
router.post('/tailor-resume', async (req, res) => {
  const { app_id, resume_text, resume_id } = req.body;
  if (!app_id) return res.status(400).json({ error: 'app_id required' });

  let text = resume_text || '';
  if (resume_id) {
    const stored = db.prepare('SELECT resume_text FROM resumes WHERE id = ?').get(resume_id);
    if (stored?.resume_text) text = stored.resume_text;
  }
  if (!text || text.trim().length < 50) {
    return res.status(400).json({ error: 'No resume text available. Select an uploaded resume or paste text.' });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(app_id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const ai = getAIClient();
  if (!ai) return res.status(503).json({ error: 'No AI provider configured.' });

  const prompt = `You are an expert resume writer. Tailor the resume below to the job posting.

Rules:
- Reorder bullets to lead with the experience most relevant to this role
- Naturally incorporate key terms and skills from the job description (for ATS)
- Tighten language and strengthen impact — do not fabricate metrics
- Keep all original section headings and do not add experience that isn't in the original
- Output the full tailored resume only — no commentary, no preamble

JOB: ${app.job_title} at ${app.company}${app.location ? ` — ${app.location}` : ''}

JOB DESCRIPTION:
${(app.job_description || 'Not provided').slice(0, 3000)}

ORIGINAL RESUME:
${text.slice(0, 5000)}`;

  try {
    const response = await ai.client.chat.completions.create({
      model: ai.smartModel,
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ tailored_resume: response.choices[0].message.content });
  } catch (err) {
    console.error('Tailor resume error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
