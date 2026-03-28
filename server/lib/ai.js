const db = require('../db');

function getAIClient() {
  const { OpenAI } = require('openai');

  const provider = db.prepare("SELECT value FROM settings WHERE key = 'ai_provider'").get()?.value || 'ollama';

  // Always check for Groq key — env var takes priority, then DB, regardless of provider setting
  const groqKey = process.env.GROQ_API_KEY ||
    db.prepare("SELECT value FROM settings WHERE key = 'groq_api_key'").get()?.value;

  if (provider === 'groq' || groqKey) {
    if (!groqKey) return null;
    return {
      client: new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' }),
      fastModel: 'llama-3.1-8b-instant',
      smartModel: 'llama-3.3-70b-versatile'
    };
  }

  const baseURL = db.prepare("SELECT value FROM settings WHERE key = 'ollama_url'").get()?.value || 'http://localhost:11434/v1';
  const model = db.prepare("SELECT value FROM settings WHERE key = 'ollama_model'").get()?.value || 'llama3.2';
  return {
    client: new OpenAI({ apiKey: 'ollama', baseURL }),
    fastModel: model,
    smartModel: model
  };
}

function calcStreak(dates) {
  if (!dates.length) return 0;
  const dateSet = new Set(dates);
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const start = dateSet.has(todayStr) ? todayStr : dateSet.has(yesterdayStr) ? yesterdayStr : null;
  if (!start) return 0;

  let streak = 0;
  const cur = new Date(start + 'T12:00:00Z');
  while (dateSet.has(cur.toISOString().split('T')[0])) {
    streak++;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }
  return streak;
}

module.exports = { getAIClient, calcStreak };
