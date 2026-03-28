// JoblyAI content script — extracts job posting data from the current page

(function () {
  'use strict';

  function cleanText(html) {
    if (!html) return '';

    // Use a detached DOM element — lets the browser decode ALL entities
    // (&#43; → +, &amp; → &, nested spans, etc.) and traverse structure properly
    const div = document.createElement('div');
    div.innerHTML = html;

    // Remove noise nodes
    div.querySelectorAll('script, style').forEach(el => el.remove());

    // Convert <br> to newlines
    div.querySelectorAll('br').forEach(br => br.replaceWith('\n'));

    // Convert <li> to bullet points
    div.querySelectorAll('li').forEach(li => {
      li.insertAdjacentText('afterbegin', '• ');
      li.insertAdjacentText('beforeend', '\n');
    });

    // Add newlines after block-level elements so paragraphs separate cleanly
    div.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, ul, ol, section').forEach(el => {
      el.insertAdjacentText('beforeend', '\n');
    });

    return div.textContent
      .replace(/[ \t]+/g, ' ')       // collapse horizontal whitespace
      .replace(/ \n/g, '\n')         // trim trailing spaces before newlines
      .replace(/\n /g, '\n')         // trim leading spaces after newlines
      .replace(/\n{3,}/g, '\n\n')    // max 2 consecutive blank lines
      .trim();
  }

  function formatSalary(baseSalary) {
    if (!baseSalary) return '';
    const v = baseSalary.value;
    if (!v) return '';
    if (v.minValue && v.maxValue) {
      const fmt = n => '$' + Math.round(n).toLocaleString();
      const unit = v.unitText ? ' / ' + v.unitText : '';
      return `${fmt(v.minValue)} – ${fmt(v.maxValue)}${unit}`;
    }
    if (v.value) return '$' + Math.round(v.value).toLocaleString();
    return '';
  }

  // ── JSON-LD extraction (Greenhouse, Lever, Ashby, SmartRecruiters, etc.) ──
  function fromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        const candidates = Array.isArray(data)
          ? data
          : data['@graph']
            ? data['@graph']
            : [data];
        const job = candidates.find(n => n['@type'] === 'JobPosting');
        if (!job) continue;

        const loc = job.jobLocation;
        const addr = Array.isArray(loc) ? loc[0]?.address : loc?.address;
        const location = [addr?.addressLocality, addr?.addressRegion, addr?.addressCountry]
          .filter(Boolean).join(', ');

        return {
          job_title: job.title || '',
          company: job.hiringOrganization?.name || '',
          location,
          salary_range: formatSalary(job.baseSalary),
          job_description: cleanText(job.description || '').slice(0, 6000),
          application_link: window.location.href,
          _source: 'json-ld'
        };
      } catch { /* continue */ }
    }
    return null;
  }

  // ── LinkedIn-specific DOM extraction ──
  // LinkedIn rotates class names — use multiple selectors and pick first match
  function queryFirst(...selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function fromLinkedIn() {
    const titleEl = queryFirst(
      'h1.job-details-jobs-unified-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title h1',
      'h1.jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title h1',
      'h1.top-card-layout__title',
      '.top-card-layout__title',
      // Generic fallback for any h1 in the job content area
      '.job-view-layout h1',
      '.jobs-search__job-details h1'
    );

    const companyEl = queryFirst(
      '.job-details-jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name a',
      '.topcard__org-name-link',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '[data-tracking-control-name="public_jobs_topcard-org-name"]',
      '.topcard__flavor a'
    );

    const locationEl = queryFirst(
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '.topcard__flavor--bullet',
      '.job-details-jobs-unified-top-card__workplace-type',
      'span.jobs-unified-top-card__workplace-type'
    );

    const descEl = queryFirst(
      '#job-details',
      '.jobs-description__content .jobs-description-content__text',
      '.jobs-description-content__text',
      '.description__text',
      '.jobs-description',
      '[class*="job-details-jobs-description"]'
    );

    if (!titleEl && !companyEl) return null;

    return {
      job_title: titleEl?.textContent?.trim() || '',
      company: companyEl?.textContent?.trim() || '',
      location: locationEl?.textContent?.trim() || '',
      job_description: cleanText(descEl?.innerHTML || '').slice(0, 6000),
      application_link: window.location.href,
      _source: 'linkedin'
    };
  }

  // ── Indeed-specific DOM extraction ──
  function fromIndeed() {
    const titleEl = queryFirst(
      'h1[data-testid="jobsearch-JobInfoHeader-title"]',
      'h1.jobsearch-JobInfoHeader-title',
      '[data-testid="jobsearch-JobInfoHeader-title"] h1',
      '.jobsearch-JobInfoHeader-title'
    );
    const companyEl = queryFirst(
      '[data-testid="inlineHeader-companyName"] a',
      '[data-testid="inlineHeader-companyName"]',
      '.jobsearch-InlineCompanyRating a',
      '[data-company-name]'
    );
    const locationEl = queryFirst(
      '[data-testid="job-location"]',
      '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
      '.jobsearch-JobInfoHeader-subtitle div[class]'
    );
    const descEl = queryFirst(
      '#jobDescriptionText',
      '.jobsearch-jobDescriptionText',
      '[id*="jobDescription"]'
    );

    if (!titleEl) return null;
    return {
      job_title: titleEl?.textContent?.trim() || '',
      company: companyEl?.textContent?.trim() || '',
      location: locationEl?.textContent?.trim() || '',
      job_description: cleanText(descEl?.innerHTML || '').slice(0, 6000),
      application_link: window.location.href,
      _source: 'indeed'
    };
  }

  // ── Workday-specific extraction ──
  function fromWorkday() {
    const titleEl = document.querySelector('[data-automation-id="jobPostingHeader"] h2, h2[data-automation-id]');
    const companyEl = document.querySelector('.WGUL, [class*="companyName"]');
    const locationEl = document.querySelector('[data-automation-id="locations"] dd, [data-automation-id="job-requisition-site-location"] dd');
    const descEl = document.querySelector('[data-automation-id="job-posting-details"], .ql-editor');

    if (!titleEl) return null;
    return {
      job_title: titleEl?.textContent?.trim() || '',
      company: companyEl?.textContent?.trim() || document.title.split(' at ')[1]?.trim() || '',
      location: locationEl?.textContent?.trim() || '',
      job_description: cleanText(descEl?.innerHTML || '').slice(0, 6000),
      application_link: window.location.href,
      _source: 'workday'
    };
  }

  // ── Generic fallback ──
  function fromGeneric() {
    const h1 = document.querySelector('h1');
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    const ogSite = document.querySelector('meta[property="og:site_name"]')?.content;
    const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.content;

    // Try to find main content area
    const mainSelectors = ['main', 'article', '[role="main"]', '#content', '.content', '.job-description', '.job-details'];
    const mainEl = mainSelectors.map(s => document.querySelector(s)).find(Boolean);

    const title = h1?.textContent?.trim() || ogTitle || twitterTitle || '';
    const company = ogSite || '';

    return {
      job_title: title,
      company,
      location: '',
      job_description: mainEl ? cleanText(mainEl.innerHTML).slice(0, 6000) : '',
      application_link: window.location.href,
      _source: 'generic'
    };
  }

  // ── Detect page type ──
  function detectSite() {
    const host = window.location.hostname.replace(/^www\./, '');
    if (host.includes('linkedin.com')) return 'linkedin';
    if (host.includes('indeed.com')) return 'indeed';
    if (host.includes('myworkdayjobs.com') || host.includes('workday.com')) return 'workday';
    return 'generic';
  }

  // ── Main extraction ──
  function extract() {
    // Always try JSON-LD first — most reliable across ATS platforms
    const fromLd = fromJsonLd();
    if (fromLd && (fromLd.job_title || fromLd.company)) return fromLd;

    const site = detectSite();
    if (site === 'linkedin') return fromLinkedIn() || fromGeneric();
    if (site === 'indeed') return fromIndeed() || fromGeneric();
    if (site === 'workday') return fromWorkday() || fromGeneric();

    return fromGeneric();
  }

  // ── Message listener ──
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'EXTRACT_JOB') {
      try {
        const result = extract();
        sendResponse({ ok: true, data: result });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    }
    return true; // keep channel open for async
  });
})();
