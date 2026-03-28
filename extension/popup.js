'use strict';

// ── State management ──────────────────────────────────────────────────────────

const STATES = ['loading', 'form', 'paste', 'saved', 'error', 'settings'];
let currentTab = null;
let extractedData = {};
let savedAppId = null;
let previousState = 'loading';

function showState(name) {
  STATES.forEach(s => {
    const el = document.getElementById('state-' + s);
    if (el) el.classList.toggle('active', s === name);
  });
}

// ── Storage helpers ───────────────────────────────────────────────────────────

async function getServerUrl() {
  return new Promise(resolve => {
    chrome.storage.sync.get({ serverUrl: 'http://localhost:3001' }, r => resolve(r.serverUrl));
  });
}

async function setServerUrl(url) {
  return new Promise(resolve => chrome.storage.sync.set({ serverUrl: url }, resolve));
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiPost(path, body) {
  const base = await getServerUrl();
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Auth-wall sites ───────────────────────────────────────────────────────────

// Only block sites where even logged-in users can't see job content
// (LinkedIn/Indeed work fine when the user is already logged in)
const AUTH_WALL_HOSTS = [
  'glassdoor.com',
  'ziprecruiter.com',
  'monster.com'
];

function isAuthWall(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return AUTH_WALL_HOSTS.some(h => host.includes(h));
  } catch { return false; }
}

// ── Source badge ──────────────────────────────────────────────────────────────

const SOURCE_LABELS = {
  'json-ld': { text: 'Auto-extracted', color: '' },
  'linkedin': { text: 'LinkedIn', color: '' },
  'indeed': { text: 'Indeed', color: '' },
  'workday': { text: 'Workday', color: '' },
  'generic': { text: 'Partial extract — review fields', color: 'warn' },
};

function renderSourceBadge(source) {
  const wrap = document.getElementById('source-badge-wrap');
  const info = SOURCE_LABELS[source] || SOURCE_LABELS.generic;
  wrap.innerHTML = `
    <div class="source-badge ${info.color}">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="${info.color === 'warn' ? 'M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z' : 'M5 13l4 4L19 7'}"/>
      </svg>
      ${info.text}
    </div>`;
}

// ── Populate form ─────────────────────────────────────────────────────────────

function populateForm(data) {
  document.getElementById('f-company').value = data.company || '';
  document.getElementById('f-title').value = data.job_title || '';
  document.getElementById('f-location').value = data.location || '';
  document.getElementById('f-salary').value = data.salary_range || '';

  // Show paste fallback if description is short/missing
  const hasGoodDesc = (data.job_description || '').length > 200;
  const sourceIsGeneric = data._source === 'generic';
  if (!hasGoodDesc || sourceIsGeneric) {
    document.getElementById('paste-fallback-section').style.display = 'block';
  }
  if (data.job_description) {
    document.getElementById('f-jd').value = data.job_description;
  }

  renderSourceBadge(data._source || 'generic');
}

// ── Save application ──────────────────────────────────────────────────────────

async function saveApplication() {
  const company = document.getElementById('f-company').value.trim();
  const job_title = document.getElementById('f-title').value.trim();

  if (!company && !job_title) {
    document.getElementById('f-company').focus();
    return;
  }

  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.innerHTML = '<svg class="spinning" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="width:14px;height:14px;animation:spin 0.7s linear infinite"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"/></svg> Saving…';

  try {
    const payload = {
      company,
      job_title,
      location: document.getElementById('f-location').value.trim(),
      salary_range: document.getElementById('f-salary').value.trim(),
      status: document.getElementById('f-status').value,
      priority: document.getElementById('f-priority').value,
      application_link: extractedData.application_link || currentTab?.url || '',
      job_description: document.getElementById('f-jd').value.trim() || extractedData.job_description || '',
      source: 'Browser Extension',
      application_date: new Date().toISOString().split('T')[0],
    };

    const result = await apiPost('/api/applications', payload);
    savedAppId = result.id;

    const cName = company || job_title;
    document.getElementById('saved-title').textContent = `Saved — ${cName}`;
    document.getElementById('saved-sub').textContent =
      `Status: ${payload.status} · Priority: ${payload.priority}`;

    showState('saved');
  } catch (err) {
    document.getElementById('error-msg').textContent =
      err.message.includes('fetch') || err.message.includes('Failed')
        ? 'Could not reach JoblyAI. Is the server running at localhost:3001?'
        : err.message;
    showState('error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" style="width:14px;height:14px"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Save to JoblyAI';
  }
}

// ── AI extraction from pasted text ───────────────────────────────────────────

async function extractFromPaste() {
  const text = document.getElementById('paste-text').value.trim();
  if (!text) return;

  const btn = document.getElementById('btn-paste-extract');
  btn.disabled = true;
  btn.textContent = 'Extracting…';

  try {
    const result = await apiPost('/api/ai/extract', { text });
    extractedData = {
      ...(result.extracted || {}),
      application_link: currentTab?.url || '',
      _source: 'paste'
    };
    populateForm(extractedData);
    showState('form');
  } catch {
    // Fall through to manual form with just the URL
    extractedData = {
      application_link: currentTab?.url || '',
      job_description: text,
      _source: 'paste'
    };
    populateForm(extractedData);
    showState('form');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Extract &amp; Fill Form';
  }
}

// ── Open app in browser ───────────────────────────────────────────────────────

async function openApp(path = '') {
  const base = await getServerUrl();
  // Try opening the Vite dev server (5173) first, then production (same port)
  const appUrl = base.replace(':3001', ':5173') + path;
  chrome.tabs.create({ url: appUrl });
  window.close();
}

// ── Decide which state to show after extraction ───────────────────────────────

function resolveState(data, url) {
  const hasTitle = !!(data.job_title || '').trim();
  const hasCompany = !!(data.company || '').trim();

  if (hasTitle || hasCompany) {
    populateForm(data);
    showState('form');
  } else {
    // Extraction got nothing useful — let the user paste instead
    // Pre-fill the URL so it gets saved with the application
    showState('paste');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  showState('loading');

  // Get active tab
  const tabs = await new Promise(resolve =>
    chrome.tabs.query({ active: true, currentWindow: true }, resolve)
  );
  currentTab = tabs[0];

  if (!currentTab?.url) {
    document.getElementById('error-msg').textContent = 'No active tab found.';
    showState('error');
    return;
  }

  const url = currentTab.url;

  // Non-http pages (new tab, extensions, chrome://) — skip to paste
  if (!url.startsWith('http')) {
    showState('paste');
    return;
  }

  // Auth-wall sites — go straight to paste
  if (isAuthWall(url)) {
    showState('paste');
    return;
  }

  // Try content script extraction
  document.getElementById('loading-msg').textContent = 'Reading job posting…';

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(currentTab.id, { type: 'EXTRACT_JOB' }, res => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(res);
      });
    });

    if (response?.ok && response.data) {
      extractedData = response.data;
    } else {
      extractedData = { application_link: url, _source: 'generic' };
    }
    resolveState(extractedData, url);
  } catch {
    // Content script not injected yet (e.g. fresh page load) — try scripting API
    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['content.js']
      });
      // Retry message after injection
      const response2 = await new Promise((resolve) => {
        setTimeout(() => {
          chrome.tabs.sendMessage(currentTab.id, { type: 'EXTRACT_JOB' }, res => {
            resolve(res || null);
          });
        }, 400);
      });

      extractedData = (response2?.ok && response2.data)
        ? response2.data
        : { application_link: url, _source: 'generic' };
      resolveState(extractedData, url);
    } catch {
      extractedData = { application_link: url, _source: 'generic' };
      resolveState(extractedData, url);
    }
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Save
  document.getElementById('btn-save').addEventListener('click', saveApplication);

  // Cancel → close popup
  document.getElementById('btn-cancel').addEventListener('click', () => window.close());
  document.getElementById('btn-paste-cancel').addEventListener('click', () => window.close());

  // Paste flow
  document.getElementById('btn-paste-extract').addEventListener('click', extractFromPaste);

  // Enter in paste area submits
  document.getElementById('paste-text').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) extractFromPaste();
  });

  // Saved → open app
  document.getElementById('btn-open-app').addEventListener('click', () => {
    const path = savedAppId ? `/applications/${savedAppId}` : '/applications';
    openApp(path);
  });

  // Error retry
  document.getElementById('btn-error-retry').addEventListener('click', init);
  document.getElementById('btn-error-paste').addEventListener('click', () => showState('paste'));

  // Settings toggle
  document.getElementById('btn-settings').addEventListener('click', async () => {
    if (document.getElementById('state-settings').classList.contains('active')) {
      showState(previousState);
    } else {
      previousState = STATES.find(s => document.getElementById('state-' + s).classList.contains('active')) || 'loading';
      const url = await getServerUrl();
      document.getElementById('s-server-url').value = url;
      showState('settings');
    }
  });

  document.getElementById('btn-settings-cancel').addEventListener('click', () => showState(previousState));
  document.getElementById('btn-settings-save').addEventListener('click', async () => {
    const url = document.getElementById('s-server-url').value.trim().replace(/\/$/, '');
    if (url) await setServerUrl(url);
    showState(previousState);
  });

  // Enter to save
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      if (document.getElementById('state-form').classList.contains('active')) {
        saveApplication();
      }
    }
  });

  init();
});
