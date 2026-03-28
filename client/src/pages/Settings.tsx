import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Mail, CheckCircle, XCircle, RefreshCw,
  ExternalLink, Loader2, Save, Shield, Cpu, Cloud, Download
} from 'lucide-react';
import { getSettings, updateSettings, getGmailStatus, getGmailAuthUrl, syncGmail, disconnectGmail } from '../lib/api';
import { formatRelative, cn } from '../lib/utils';
import LinkedInImportModal from '../components/ui/LinkedInImportModal';

export default function Settings() {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const [aiProvider, setAiProvider] = useState('ollama');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3.2');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const { data: gmailStatus, refetch: refetchGmail } = useQuery({ queryKey: ['gmail-status'], queryFn: getGmailStatus });

  useEffect(() => {
    if (settings) {
      setAiProvider(settings.ai_provider || 'ollama');
      setOllamaUrl(settings.ollama_url || 'http://localhost:11434');
      setOllamaModel(settings.ollama_model || 'llama3.2');
      setGroqApiKey(settings.groq_api_key || '');
      setAutoUpdate(settings.auto_status_update !== 'false');
    }
  }, [settings]);

  useEffect(() => {
    const gmailParam = searchParams.get('gmail');
    if (gmailParam === 'connected') {
      toast.success('Gmail connected successfully!');
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
    } else if (gmailParam === 'error') {
      toast.error('Gmail connection failed. Please try again.');
    }
  }, [searchParams]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSettings({
        ai_provider: aiProvider,
        ollama_url: ollamaUrl,
        ollama_model: ollamaModel,
        groq_api_key: groqApiKey,
        auto_status_update: autoUpdate ? 'true' : 'false'
      });
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleGmailConnect = async () => {
    try {
      const { authUrl } = await getGmailAuthUrl();
      window.location.href = authUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gmail credentials not configured';
      toast.error(msg);
    }
  };

  const handleGmailSync = async () => {
    setSyncing(true);
    try {
      const result = await syncGmail();
      toast.success(`Synced ${result.processed} emails`);
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleGmailDisconnect = async () => {
    if (!confirm('Disconnect Gmail?')) return;
    try {
      await disconnectGmail();
      qc.invalidateQueries({ queryKey: ['gmail-status'] });
      toast.success('Gmail disconnected');
    } catch {
      toast.error('Failed');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Configure integrations and AI features</p>
      </div>

      {/* AI Settings */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-4.5 h-4.5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Features — Free</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Powers job extraction, resume matching, and AI assistant</p>
          </div>
        </div>

        {/* Provider toggle */}
        <div>
          <label className="label">AI Provider</label>
          <div className="flex gap-2">
            <button
              onClick={() => setAiProvider('ollama')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors',
                aiProvider === 'ollama'
                  ? 'bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-900/20 dark:border-violet-700 dark:text-violet-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <Cpu className="w-4 h-4" /> Ollama (local)
            </button>
            <button
              onClick={() => setAiProvider('groq')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors',
                aiProvider === 'groq'
                  ? 'bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-900/20 dark:border-violet-700 dark:text-violet-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <Cloud className="w-4 h-4" /> Groq (free cloud)
            </button>
          </div>
        </div>

        {aiProvider === 'ollama' ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Setup (one-time)</div>
              <ol className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-decimal list-inside">
                <li>Install Ollama at <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline inline-flex items-center gap-0.5">ollama.com <ExternalLink className="w-3 h-3" /></a></li>
                <li>Run: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">ollama pull llama3.2</code></li>
                <li>Ollama starts automatically — no API key needed</li>
              </ol>
            </div>
            <div>
              <label className="label">Ollama URL</label>
              <input
                type="text"
                className="input"
                value={ollamaUrl}
                onChange={e => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
            <div>
              <label className="label">Model</label>
              <input
                type="text"
                className="input"
                value={ollamaModel}
                onChange={e => setOllamaModel(e.target.value)}
                placeholder="llama3.2"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Other options: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">mistral</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">llama3.1</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">qwen2.5</code>
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Free — no credit card required</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Groq offers a generous free tier. Get your key at{' '}
                <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline inline-flex items-center gap-0.5">
                  console.groq.com <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <div>
              <label className="label">Groq API Key</label>
              <input
                type="password"
                className="input"
                value={groqApiKey}
                onChange={e => setGroqApiKey(e.target.value)}
                placeholder="gsk_..."
              />
            </div>
            {groqApiKey && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                AI features will be enabled after saving
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gmail Integration */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4.5 h-4.5 text-red-500 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Gmail Integration</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Read-only tracking, classification, and status updates</p>
          </div>
          {gmailStatus?.connected && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle className="w-3 h-3" /> Connected
            </span>
          )}
        </div>

        {/* Privacy notice */}
        <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
          <Shield className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 dark:text-amber-300">
            <strong>Read-only access only.</strong> This app only reads your emails — it never sends messages, creates drafts, or modifies your inbox in any way.
          </div>
        </div>

        {!gmailStatus?.hasCredentials ? (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Setup Required</div>
              <ol className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5 list-decimal list-inside">
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Google Cloud Console</a></li>
                <li>Create a project and enable the Gmail API</li>
                <li>Create OAuth 2.0 credentials (Web Application)</li>
                <li>Add redirect URI: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded text-xs">http://localhost:3001/api/gmail/callback</code></li>
                <li>Add <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded text-xs">GOOGLE_CLIENT_ID</code> and <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded text-xs">GOOGLE_CLIENT_SECRET</code> to <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded text-xs">server/.env</code></li>
                <li>Restart the server</li>
              </ol>
            </div>
          </div>
        ) : gmailStatus.connected ? (
          <div className="space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {gmailStatus.lastSync
                ? `Last synced ${formatRelative(gmailStatus.lastSync)}`
                : 'Not synced yet'
              }
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={autoUpdate}
                  onChange={e => setAutoUpdate(e.target.checked)}
                  className="w-4 h-4 rounded text-primary-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Auto-update application status from emails</span>
              </label>
              <p className="text-xs text-slate-400 dark:text-slate-500 ml-6">
                Automatically move applications to Rejected, Interview, etc. when matching emails are detected
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleGmailSync} disabled={syncing} className="btn-primary flex-1">
                {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</> : <><RefreshCw className="w-4 h-4" /> Sync Now</>}
              </button>
              <button onClick={handleGmailDisconnect} className="btn-secondary text-red-600 hover:text-red-700 dark:text-red-400">
                <XCircle className="w-4 h-4" /> Disconnect
              </button>
            </div>
          </div>
        ) : (
          <button onClick={handleGmailConnect} className="btn-primary w-full">
            <Mail className="w-4 h-4" /> Connect Gmail
          </button>
        )}
      </div>

      {/* LinkedIn Import */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Import LinkedIn Data</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Bulk-import your job application history from a LinkedIn data export</p>
          </div>
        </div>
        <button onClick={() => setShowImport(true)} className="btn-secondary w-full">
          <Download className="w-4 h-4" /> Import LinkedIn Archive (.zip or .csv)
        </button>
      </div>

      {/* About */}
      <div className="card p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">About JoblyAI</h2>
        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <div>Version 1.0.0 — Personal Job Application Tracker</div>
          <div>Single-user, local SQLite database. All data stored on your machine.</div>
          <div>Built with React, Express, and SQLite.</div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={handleSaveSettings} disabled={savingSettings} className="btn-primary">
          {savingSettings ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Settings</>}
        </button>
      </div>

      {showImport && <LinkedInImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
