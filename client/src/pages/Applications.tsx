import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Search, Filter, SortAsc, SortDesc, Trash2, ExternalLink,
  ChevronUp, ChevronDown, Plus, MoreHorizontal, Sparkles
} from 'lucide-react';
import { getApplications, deleteApplication, clearApplications, updateStatus } from '../lib/api';
import StatusBadge from '../components/applications/StatusBadge';
import Modal from '../components/ui/Modal';
import ApplicationForm from '../components/applications/ApplicationForm';
import IntakeModal from '../components/ui/IntakeModal';
import OfferComparisonModal from '../components/ui/OfferComparisonModal';
import { ALL_STATUSES, PRIORITY_COLORS, type Application, type ApplicationStatus } from '../types';
import { formatDate, cn, SOURCES } from '../lib/utils';

type SortKey = 'company' | 'status' | 'application_date' | 'priority' | 'updated_at';

export default function Applications() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated_at');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [showForm, setShowForm] = useState(false);
  const [showIntake, setShowIntake] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const navigate = useNavigate();
  const qc = useQueryClient();

  const params: Record<string, string> = { sort: sortKey, order: sortDir };
  if (statusFilter !== 'all') params.status = statusFilter;
  if (sourceFilter) params.source = sourceFilter;
  if (priorityFilter) params.priority = priorityFilter;
  if (search) params.search = search;

  const { data, isLoading } = useQuery({
    queryKey: ['applications', params],
    queryFn: () => getApplications(params)
  });

  const applications = data?.applications || [];
  const offerCount = useMemo(() => applications.filter(a => a.status === 'Offer').length, [applications]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    else { setSortKey(key); setSortDir('DESC'); }
  };

  const handleClearAll = async () => {
    const total = data?.total || 0;
    if (!confirm(`Delete all ${total} applications? This cannot be undone.`)) return;
    try {
      await clearApplications();
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('All applications deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this application?')) return;
    try {
      await deleteApplication(id);
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await updateStatus(id, status);
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Status updated to ${status}`);
    } catch {
      toast.error('Update failed');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 text-slate-300" />;
    return sortDir === 'ASC'
      ? <ChevronUp className="w-3 h-3 text-primary-500" />
      : <ChevronDown className="w-3 h-3 text-primary-500" />;
  };

  const thClass = 'px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none';

  return (
    <div className="p-6 space-y-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Applications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isLoading ? '…' : `${data?.total || 0} total`}
          </p>
        </div>
        <div className="flex gap-2">
          {(data?.total ?? 0) > 0 && (
            <button onClick={handleClearAll} className="btn-ghost text-xs text-slate-400 hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" /> Delete All
            </button>
          )}
          {offerCount >= 2 && (
            <button onClick={() => setShowCompare(true)} className="btn-secondary">
              <Sparkles className="w-4 h-4" /> Compare Offers
            </button>
          )}
          <button onClick={() => setShowIntake(true)} className="btn-secondary">
            <Sparkles className="w-4 h-4" /> Quick Intake
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Application
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9 w-56"
            placeholder="Search company, title…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="input w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className="input w-36" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="">All Sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className="input w-32" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {(statusFilter !== 'all' || sourceFilter || priorityFilter || search) && (
          <button onClick={() => { setStatusFilter('all'); setSourceFilter(''); setPriorityFilter(''); setSearch(''); }}
            className="btn-ghost text-xs">Clear filters</button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className={thClass} onClick={() => handleSort('company')}>
                  <span className="flex items-center gap-1">Company <SortIcon col="company" /></span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Job Title</th>
                <th className={thClass} onClick={() => handleSort('status')}>
                  <span className="flex items-center gap-1">Status <SortIcon col="status" /></span>
                </th>
                <th className={thClass} onClick={() => handleSort('priority')}>
                  <span className="flex items-center gap-1">Priority <SortIcon col="priority" /></span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</th>
                <th className={thClass} onClick={() => handleSort('application_date')}>
                  <span className="flex items-center gap-1">Applied <SortIcon col="application_date" /></span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Follow-up</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">Loading…</td></tr>
              )}
              {!isLoading && applications.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">
                  No applications found. Add your first one!
                </td></tr>
              )}
              {applications.map(app => (
                <tr
                  key={app.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/applications/${app.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{app.company}</div>
                    {app.referral_used && (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400">Referral</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{app.job_title || '—'}</div>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select
                      className="text-xs rounded-full border-0 font-medium cursor-pointer bg-transparent focus:ring-1 focus:ring-primary-500 py-0.5 pr-5"
                      value={app.status}
                      onChange={e => handleStatusChange(app.id, e.target.value)}
                    >
                      {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-block text-xs font-medium px-2 py-0.5 rounded-full',
                      PRIORITY_COLORS[app.priority]
                    )}>
                      {app.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 max-w-[120px] truncate">
                    {app.location || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{app.source || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {formatDate(app.application_date, 'MMM d')}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {app.follow_up_date ? (
                      <span className={cn(
                        'text-xs font-medium',
                        new Date(app.follow_up_date) < new Date() ? 'text-red-600' : 'text-slate-500'
                      )}>
                        {formatDate(app.follow_up_date, 'MMM d')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {app.application_link && (
                        <a href={app.application_link} target="_blank" rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button onClick={() => handleDelete(app.id)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showForm || editApp) && (
        <Modal
          title={editApp ? `Edit — ${editApp.company}` : 'Add Application'}
          onClose={() => { setShowForm(false); setEditApp(null); }}
          size="2xl"
        >
          <ApplicationForm
            initial={editApp || {}}
            onSave={() => { setShowForm(false); setEditApp(null); }}
            onCancel={() => { setShowForm(false); setEditApp(null); }}
          />
        </Modal>
      )}

      {/* Quick Intake Modal */}
      {showIntake && <IntakeModal onClose={() => setShowIntake(false)} />}

      {/* Offer Comparison Modal */}
      {showCompare && <OfferComparisonModal onClose={() => setShowCompare(false)} />}
    </div>
  );
}
