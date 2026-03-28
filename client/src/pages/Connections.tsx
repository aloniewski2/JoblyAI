import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Search, Users, Building2, Link2, Sparkles, Trash2, Upload, RotateCcw, Copy, Send, X, Loader2 } from 'lucide-react';
import {
  getContacts, getContactStats, getContactCompanies, deleteContact, clearContacts,
  aiWarmIntro, type Contact
} from '../lib/api';
import ConnectionsImportModal from '../components/ui/ConnectionsImportModal';
import { cn } from '../lib/utils';

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Connections() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [filterApplied, setFilterApplied] = useState(false);
  const [introDraft, setIntroDraft] = useState<{ contact: Contact; message: string } | null>(null);
  const [draftingId, setDraftingId] = useState<number | null>(null);

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (companyFilter) params.company = companyFilter;

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', params],
    queryFn: () => getContacts(params)
  });

  const { data: stats } = useQuery({
    queryKey: ['contact-stats'],
    queryFn: getContactStats
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['contact-companies'],
    queryFn: getContactCompanies
  });

  const contacts = data?.contacts || [];
  const displayed = filterApplied ? contacts.filter(c => c.at_applied_company) : contacts;

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Remove ${name} from connections?`)) return;
    try {
      await deleteContact(id);
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact-stats'] });
      toast.success('Removed');
    } catch {
      toast.error('Failed');
    }
  };

  const handleDraftIntro = async (contact: Contact) => {
    if (!contact.matched_app_id) return;
    setDraftingId(contact.id);
    try {
      const result = await aiWarmIntro(contact.matched_app_id, contact.id);
      setIntroDraft({ contact, message: result.message });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI unavailable');
    } finally {
      setDraftingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm(`Delete all ${stats?.total || 0} connections? This cannot be undone.`)) return;
    try {
      await clearContacts();
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact-stats'] });
      qc.invalidateQueries({ queryKey: ['contact-companies'] });
      toast.success('All connections cleared');
    } catch {
      toast.error('Failed');
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Connections</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Your LinkedIn network, searchable alongside your job search</p>
        </div>
        <div className="flex gap-2">
          {(stats?.total ?? 0) > 0 && (
            <button onClick={handleClearAll} className="btn-ghost text-xs text-slate-400 hover:text-red-500">
              <RotateCcw className="w-3.5 h-3.5" /> Re-import
            </button>
          )}
          <button onClick={() => setShowImport(true)} className="btn-primary">
            <Upload className="w-4 h-4" /> Import Connections
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total Connections" value={stats.total.toLocaleString()} />
          <StatCard label="Companies" value={stats.companies.toLocaleString()} />
          <StatCard
            label="At Companies You've Applied To"
            value={stats.atAppliedCompanies}
            sub={stats.atAppliedCompanies > 0 ? 'potential warm intros' : undefined}
          />
          <StatCard label="Linked to Applications" value={stats.linked} />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (stats?.total ?? 0) === 0 && (
        <div className="card p-16 text-center space-y-4">
          <Users className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto" />
          <div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">No connections imported yet</div>
            <div className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Upload your LinkedIn data archive (.zip) to import your network. JoblyAI will highlight which connections work at companies you've applied to.
            </div>
          </div>
          <button onClick={() => setShowImport(true)} className="btn-primary mx-auto">
            <Upload className="w-4 h-4" /> Import LinkedIn Connections
          </button>
        </div>
      )}

      {/* Filters */}
      {(stats?.total ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9 w-64"
              placeholder="Search name, company, position…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <select
            className="input w-52"
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
          >
            <option value="">All Companies</option>
            {companies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <button
            onClick={() => setFilterApplied(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
              filterApplied
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            At applied companies
            {filterApplied && stats?.atAppliedCompanies ? ` (${stats.atAppliedCompanies})` : ''}
          </button>

          {(search || companyFilter || filterApplied) && (
            <button
              onClick={() => { setSearch(''); setCompanyFilter(''); setFilterApplied(false); }}
              className="btn-ghost text-xs"
            >
              Clear
            </button>
          )}

          <span className="ml-auto text-xs text-slate-400">{displayed.length} shown</span>
        </div>
      )}

      {/* Table */}
      {(stats?.total ?? 0) > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Connected</th>
                  <th className="px-4 py-3 w-36"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
                )}
                {!isLoading && displayed.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">No connections match your filters.</td></tr>
                )}
                {displayed.map(contact => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    isDrafting={draftingId === contact.id}
                    onDelete={() => handleDelete(contact.id, `${contact.first_name} ${contact.last_name}`.trim())}
                    onDraft={contact.at_applied_company && contact.matched_app_id ? () => handleDraftIntro(contact) : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showImport && <ConnectionsImportModal onClose={() => { setShowImport(false); }} />}

      {/* Warm intro draft panel */}
      {introDraft && (() => {
        const { contact, message } = introDraft;
        const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1${contact.email ? `&to=${encodeURIComponent(contact.email)}` : ''}&su=${encodeURIComponent(`Quick question re: ${contact.company}`)}&body=${encodeURIComponent(message)}`;
        return (
          <div className="fixed bottom-6 right-6 w-96 card p-5 shadow-xl border border-emerald-200 dark:border-emerald-800 z-50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                Warm intro to {name}
              </div>
              <button onClick={() => setIntroDraft(null)} className="text-slate-400 hover:text-slate-600 p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              className="input w-full text-xs leading-relaxed"
              rows={5}
              value={message}
              onChange={e => setIntroDraft(d => d ? { ...d, message: e.target.value } : null)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(message); toast.success('Copied to clipboard'); }}
                className="btn-secondary text-xs flex-1"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              {contact.email && (
                <a href={gmailUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs flex-1 text-center">
                  <Send className="w-3.5 h-3.5" /> Open in Gmail
                </a>
              )}
              <button
                onClick={() => handleDraftIntro(contact)}
                disabled={draftingId === contact.id}
                className="btn-ghost text-xs text-slate-400 px-2"
              >
                {draftingId === contact.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '↺'}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ContactRow({ contact, onDelete, onDraft, isDrafting }: {
  contact: Contact;
  onDelete: () => void;
  onDraft?: () => void;
  isDrafting?: boolean;
}) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ');

  return (
    <tr className={cn(
      'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group',
      contact.at_applied_company && 'bg-emerald-50/40 dark:bg-emerald-900/5'
    )}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-500 flex-shrink-0">
            {contact.first_name?.charAt(0) || contact.company?.charAt(0) || '?'}
          </div>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{fullName || '—'}</div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-700 dark:text-slate-300">{contact.company || '—'}</span>
          {contact.at_applied_company && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Sparkles className="w-2.5 h-2.5" /> applied
            </span>
          )}
        </div>
        {contact.linked_job_title && (
          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            <Link2 className="w-2.5 h-2.5" /> {contact.linked_job_title}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 max-w-[200px] truncate">
        {contact.position || '—'}
      </td>
      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        {contact.email ? (
          <a href={`mailto:${contact.email}`} className="text-primary-600 hover:underline" onClick={e => e.stopPropagation()}>
            {contact.email}
          </a>
        ) : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">{contact.connected_on || '—'}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onDraft && (
            <button
              onClick={onDraft}
              disabled={isDrafting}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 transition-colors"
            >
              {isDrafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Draft Intro
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
