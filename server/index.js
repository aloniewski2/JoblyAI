require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => {
    // Allow: no origin (curl, Postman), localhost, and browser extensions
    if (!origin ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('chrome-extension://') ||
        origin.startsWith('moz-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/applications', require('./routes/applications'));
app.use('/api/import', require('./routes/import'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/today', require('./routes/dashboard')); // reuse router, handles /today path
app.use('/api/resumes', require('./routes/resumes'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/gmail', require('./routes/gmail'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/contacts', require('./routes/contacts'));

// Quick-add URL extraction
app.post('/api/quick-add/extract', async (req, res) => {
  const { url, text } = req.body;

  if (text) {
    // Text path — run AI extraction directly
    const { getAIClient } = require('./lib/ai');
    const ai = getAIClient();
    if (!ai) return res.json({ extracted: { job_description: text } });
    try {
      const response = await ai.client.chat.completions.create({
        model: ai.fastModel,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Extract job posting information from the following text. Return ONLY valid JSON:
{"company":"","job_title":"","location":"","salary_range":"","job_description":""}
If a field is not found, use an empty string.

${text.slice(0, 8000)}`
        }]
      });
      const jsonMatch = response.choices[0].message.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return res.json({ extracted: JSON.parse(jsonMatch[0]) });
    } catch { /* fall through */ }
    return res.json({ extracted: { job_description: text } });
  }

  if (!url) return res.json({ extracted: {} });

  // Sites that require login or JS rendering — can't be scraped
  const AUTH_WALL_HOSTS = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com', 'monster.com'];
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (AUTH_WALL_HOSTS.some(h => host.includes(h))) {
      return res.json({
        extracted: { application_link: url },
        warning: `${host} requires login to view job details. Copy and paste the job description text instead.`
      });
    }
  } catch {
    return res.json({ extracted: {}, warning: 'Invalid URL.' });
  }

  try {
    const fetch = require('node-fetch');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    clearTimeout(timeout);

    const html = await response.text();
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);

    // Detect auth walls by page content
    const bodyText = $('body').text().toLowerCase();
    const authPhrases = ['sign in to view', 'log in to view', 'please sign in', 'create an account to', 'join to see'];
    if (authPhrases.some(p => bodyText.includes(p))) {
      return res.json({
        extracted: { application_link: url },
        warning: 'This page requires login. Copy and paste the job description text instead.'
      });
    }

    // Remove noise
    $('script, style, nav, header, footer, aside, [role="navigation"], .nav, .header, .footer, .cookie, .banner').remove();

    let extracted = {};

    // JSON-LD structured data (works on Greenhouse, Lever, Workday, many company sites)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        const job = data['@type'] === 'JobPosting' ? data
          : Array.isArray(data['@graph']) ? data['@graph'].find(n => n['@type'] === 'JobPosting')
          : null;
        if (job) {
          extracted = {
            job_title: job.title || '',
            company: job.hiringOrganization?.name || '',
            location: [
              job.jobLocation?.address?.addressLocality,
              job.jobLocation?.address?.addressRegion
            ].filter(Boolean).join(', '),
            salary_range: job.baseSalary?.value?.minValue && job.baseSalary?.value?.maxValue
              ? `$${job.baseSalary.value.minValue.toLocaleString()} – $${job.baseSalary.value.maxValue.toLocaleString()}`
              : '',
            job_description: job.description
              ? job.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 5000)
              : ''
          };
        }
      } catch { /* ignore */ }
    });

    // Page text for AI fallback
    const pageText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000);

    // Check if we have meaningful content
    if (pageText.length < 200 && !extracted.job_title) {
      return res.json({
        extracted: { application_link: url },
        warning: 'Could not read the page content (may require login or JavaScript). Paste the job description text instead.'
      });
    }

    // AI extraction if JSON-LD didn't give us a title
    if (!extracted.job_title && pageText.length > 200) {
      try {
        const { getAIClient } = require('./lib/ai');
        const ai = getAIClient();
        if (ai) {
          const aiResponse = await ai.client.chat.completions.create({
            model: ai.fastModel,
            max_tokens: 1500,
            messages: [{
              role: 'user',
              content: `Extract job posting info from this webpage text. Return ONLY JSON:
{"company":"","job_title":"","location":"","salary_range":"","job_description":""}
Use empty string for missing fields.

${pageText}`
            }]
          });
          const jsonMatch = aiResponse.choices[0].message.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) extracted = { ...extracted, ...JSON.parse(jsonMatch[0]) };
        }
      } catch { /* AI failed */ }
    }

    // Meta tag fallbacks
    if (!extracted.job_title) {
      extracted.job_title = $('h1').first().text().trim() ||
        $('meta[property="og:title"]').attr('content') || '';
    }
    if (!extracted.company) {
      extracted.company = $('meta[property="og:site_name"]').attr('content') || '';
    }

    const hasContent = extracted.job_title || extracted.company || extracted.job_description;
    res.json({
      extracted,
      warning: hasContent ? undefined : 'Could not extract job details automatically. Fill in manually or paste the job description text.'
    });
  } catch (err) {
    console.error('URL extraction error:', err.message);
    const isTimeout = err.name === 'AbortError';
    res.json({
      extracted: { application_link: url },
      warning: isTimeout
        ? 'The page took too long to load. Paste the job description text instead.'
        : 'Could not fetch this URL. Paste the job description text instead.'
    });
  }
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve built frontend in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`✅ JoblyAI server running at http://localhost:${PORT}`);
});
