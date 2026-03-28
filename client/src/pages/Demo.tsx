import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, TrendingUp, MessageSquare, Trophy, XCircle, Bell, Flame,
  AlertTriangle, Calendar, ArrowRight, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import StatusBadge from '../components/applications/StatusBadge';
import { cn } from '../lib/utils';
import type { ApplicationStatus } from '../types';

// ── Static demo data ────────────────────────────────────────────────────────

const STATS = { total: 16, thisWeek: 4, interviews: 3, offers: 1, rejections: 2, followUpsDue: 3, streak: 7 };

const STATUS_BREAKDOWN = [
  { status: 'Applied', count: 4 },
  { status: 'Interview Round 1', count: 2 },
  { status: 'Interview Round 2', count: 1 },
  { status: 'Final Round', count: 1 },
  { status: 'Recruiter Screen', count: 2 },
  { status: 'Offer', count: 1 },
  { status: 'Interested', count: 2 },
  { status: 'Rejected', count: 2 },
  { status: 'Planning to Apply', count: 1 },
];

const BY_SOURCE = [
  { source: 'LinkedIn', count: 7 },
  { source: 'Company Site', count: 4 },
  { source: 'Recruiter', count: 3 },
  { source: 'Referral', count: 2 },
];

const APPS: Array<{
  id: number; company: string; job_title: string; status: ApplicationStatus;
  location: string; salary_range: string; application_date: string;
  priority: string; source: string; referral_used: boolean; days_since?: number;
}> = [
  { id: 1, company: 'McKinsey & Company', job_title: 'Associate — Business & Financial Strategy', status: 'Interview Round 2', location: 'New York, NY', salary_range: '$175k–$220k', application_date: '2026-03-06', priority: 'high', source: 'Company Site', referral_used: true },
  { id: 2, company: 'Bain & Company', job_title: 'Case Team Leader', status: 'Offer', location: 'New York, NY', salary_range: '$170k–$205k', application_date: '2026-03-12', priority: 'high', source: 'Referral', referral_used: true },
  { id: 3, company: 'Oliver Wyman', job_title: 'Engagement Manager — Risk & Regulatory', status: 'Final Round', location: 'New York, NY', salary_range: '$175k–$215k', application_date: '2026-03-18', priority: 'high', source: 'Recruiter', referral_used: false },
  { id: 4, company: 'Capital One', job_title: 'Senior Manager, Risk Strategy', status: 'Interview Round 1', location: 'McLean, VA', salary_range: '$145k–$175k', application_date: '2026-03-15', priority: 'medium', source: 'LinkedIn', referral_used: true },
  { id: 5, company: 'BCG', job_title: 'Consultant — Financial Institutions', status: 'Recruiter Screen', location: 'Boston, MA', salary_range: '$165k–$210k', application_date: '2026-03-09', priority: 'high', source: 'LinkedIn', referral_used: false },
  { id: 6, company: 'Stripe', job_title: 'Strategy & Operations Manager', status: 'Applied', location: 'San Francisco, CA', salary_range: '$160k–$195k', application_date: '2026-03-13', priority: 'high', source: 'Company Site', referral_used: false, days_since: 14 },
  { id: 7, company: 'Goldman Sachs', job_title: 'VP — Transaction Banking', status: 'Applied', location: 'New York, NY', salary_range: '$200k–$250k', application_date: '2026-03-17', priority: 'high', source: 'Recruiter', referral_used: false, days_since: 10 },
  { id: 8, company: 'Plaid', job_title: 'Head of Business Operations', status: 'Planning to Apply', location: 'San Francisco, CA', salary_range: '$170k–$210k', application_date: '2026-03-22', priority: 'medium', source: 'LinkedIn', referral_used: false },
  { id: 9, company: 'Figma', job_title: 'Director of Strategy & Corp Dev', status: 'Interested', location: 'San Francisco, CA', salary_range: '$180k–$220k', application_date: '2026-03-24', priority: 'medium', source: 'LinkedIn', referral_used: false },
  { id: 10, company: 'Amazon', job_title: 'Senior PM — AWS Financial Services', status: 'Rejected', location: 'Seattle, WA', salary_range: '$155k–$200k', application_date: '2026-03-21', priority: 'low', source: 'LinkedIn', referral_used: false },
];

const NO_RESPONSE = APPS.filter(a => a.days_since);

const UPCOMING_INTERVIEWS = [
  { company: 'McKinsey & Company', job_title: 'Associate — Business & Financial Strategy', interview_date: '2026-03-29', status: 'Interview Round 2' },
  { company: 'Capital One', job_title: 'Senior Manager, Risk Strategy', interview_date: '2026-03-30', status: 'Interview Round 1' },
];

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#64748b', '#a78bfa', '#34d399'];
const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

// ── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color: string;
}) => (
  <div className="card p-5 flex items-start gap-4 pointer-events-none select-none">
    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// ── Demo Page ────────────────────────────────────────────────────────────────

export default function Demo() {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const visibleApps = showAll ? APPS : APPS.slice(0, 6);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Demo banner */}
      <div className="rounded-xl bg-primary-600 text-white px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 flex-shrink-0 opacity-80" />
          <div>
            <div className="text-sm font-semibold">Demo Preview — sample data only</div>
            <div className="text-xs opacity-75 mt-0.5">This shows what JoblyAI looks like with an active job search. Your real tracker is empty and private.</div>
          </div>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex-shrink-0 bg-white text-primary-700 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary-50 transition-colors flex items-center gap-1.5"
        >
          Start tracking <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard <span className="text-slate-400 font-normal text-base">— demo</span></h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">A sample job search pipeline for a consulting / fintech candidate</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard icon={Briefcase} label="Total Applications" value={STATS.total} color="bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400" />
        <StatCard icon={TrendingUp} label="This Week" value={STATS.thisWeek} sub="new applications" color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
        <StatCard icon={MessageSquare} label="In Progress" value={STATS.interviews} sub="active rounds" color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" />
        <StatCard icon={Trophy} label="Offers" value={STATS.offers} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <StatCard icon={XCircle} label="Rejections" value={STATS.rejections} color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
        <StatCard icon={Bell} label="Follow-ups Due" value={STATS.followUpsDue} color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
        <StatCard icon={Flame} label="Day Streak" value={STATS.streak} sub="keep it going" color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {NO_RESPONSE.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">No Response — Follow Up</h2>
              <span className="ml-auto text-xs text-slate-400">{NO_RESPONSE.length} applications</span>
            </div>
            <div className="space-y-2">
              {NO_RESPONSE.map(a => (
                <div key={a.id} className="flex items-center justify-between py-1.5 rounded px-1.5 -mx-1.5">
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.company}</div>
                    <div className="text-xs text-slate-500">{a.job_title}</div>
                  </div>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full',
                    (a.days_since ?? 0) >= 14 ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'
                  )}>{a.days_since}d ago</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {UPCOMING_INTERVIEWS.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-primary-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Upcoming Interviews</h2>
            </div>
            <div className="space-y-2">
              {UPCOMING_INTERVIEWS.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 rounded px-1.5 -mx-1.5">
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.company}</div>
                    <div className="text-xs text-slate-500">{a.job_title}</div>
                  </div>
                  <div className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                    {new Date(a.interview_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Pipeline by Status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={STATUS_BREAKDOWN} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="status" width={140} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: number) => [v, 'Applications']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {STATUS_BREAKDOWN.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Applications by Source</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={BY_SOURCE} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                {BY_SOURCE.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Applications table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sample Pipeline</h2>
          <span className="text-xs text-slate-400">{APPS.length} applications</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-2.5">Company</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-2.5">Role</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-2.5">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-2.5">Priority</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-2.5">Location</th>
                <th className="text-left text-xs font-medium text-slate-500 px-4 py-2.5">Salary</th>
              </tr>
            </thead>
            <tbody>
              {visibleApps.map(app => (
                <tr key={app.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      {app.company}
                      {app.referral_used && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-1.5 py-0.5 rounded-full font-normal">Referral</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">{app.job_title}</td>
                  <td className="px-4 py-3"><StatusBadge status={app.status} size="sm" /></td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', PRIORITY_COLORS[app.priority])}>
                      {app.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{app.location}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{app.salary_range}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {APPS.length > 6 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowAll(v => !v)}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
            >
              {showAll ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Show all {APPS.length} applications</>}
            </button>
          </div>
        )}
      </div>

      {/* Feature callouts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Sparkles, title: 'AI-powered intake', desc: 'Paste any job description — AI extracts the details, scores your fit, and recommends whether to apply.' },
          { icon: Bell, title: 'Follow-up automation', desc: 'Auto-detects stale applications and drafts personalized follow-up emails ready to copy and send.' },
          { icon: MessageSquare, title: 'Interview prep trigger', desc: 'Move a role to Interview and get an instant AI-generated prep guide — questions, topics, and tips.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card p-5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="card p-8 text-center space-y-3">
        <div className="text-base font-semibold text-slate-900 dark:text-slate-100">Ready to track your own search?</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">Your tracker is empty and waiting. Add your first application to get started.</div>
        <button
          onClick={() => navigate('/applications')}
          className="btn-primary mx-auto"
        >
          Go to My Applications <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
