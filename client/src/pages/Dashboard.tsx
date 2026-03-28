import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, TrendingUp, MessageSquare, Trophy,
  XCircle, Bell, AlertTriangle, Calendar, ArrowRight, Flame
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import StatusBadge from '../components/applications/StatusBadge';
import { formatDate, formatRelative, cn } from '../lib/utils';
import { STATUS_DOT_COLORS, type ApplicationStatus } from '../types';

const STATUS_CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#64748b', '#a78bfa', '#34d399', '#fb923c', '#f87171'
];

const StatCard = ({ icon: Icon, label, value, sub, color, onClick }: {
  icon: React.ElementType; label: string; value: number | string;
  sub?: string; color: string; onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={cn('card p-5 flex items-start gap-4', onClick && 'cursor-pointer hover:shadow-md transition-shadow')}
  >
    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</div>
      {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  </div>
);

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });
  const navigate = useNavigate();

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <div className="text-slate-400">Loading dashboard…</div>
    </div>
  );

  if (!data) return null;
  const { stats, statusBreakdown, bySource, recentActivity, noResponseAlert, upcomingInterviews } = data;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Your job search at a glance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard
          icon={Briefcase} label="Total Applications" value={stats.total}
          color="bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
          onClick={() => navigate('/applications')}
        />
        <StatCard
          icon={TrendingUp} label="This Week" value={stats.thisWeek}
          sub="new applications"
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatCard
          icon={MessageSquare} label="In Progress" value={stats.interviews}
          sub="active rounds"
          color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          onClick={() => navigate('/kanban')}
        />
        <StatCard
          icon={Trophy} label="Offers" value={stats.offers}
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
        <StatCard
          icon={XCircle} label="Rejections" value={stats.rejections}
          color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        />
        <StatCard
          icon={Bell} label="Follow-ups Due" value={stats.followUpsDue}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          onClick={() => navigate('/today')}
        />
        <StatCard
          icon={Flame} label="Day Streak" value={stats.streak ?? 0}
          sub={stats.streak > 0 ? 'keep it going' : 'apply today'}
          color={stats.streak > 0 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}
        />
      </div>

      {/* Alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* No Response Alerts */}
        {noResponseAlert.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                No Response — Follow Up
              </h2>
              <span className="ml-auto text-xs text-slate-400">{noResponseAlert.length} applications</span>
            </div>
            <div className="space-y-2">
              {noResponseAlert.slice(0, 4).map(a => (
                <div
                  key={a.id}
                  onClick={() => navigate(`/applications/${a.id}`)}
                  className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-1.5 -mx-1.5 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.company}</div>
                    <div className="text-xs text-slate-500">{a.job_title}</div>
                  </div>
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    a.days_since >= 21 ? 'bg-red-100 text-red-700' :
                      a.days_since >= 14 ? 'bg-amber-100 text-amber-700' :
                        'bg-yellow-100 text-yellow-700'
                  )}>
                    {a.days_since}d ago
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Interviews */}
        {upcomingInterviews.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-primary-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Upcoming Interviews</h2>
            </div>
            <div className="space-y-2">
              {upcomingInterviews.map(a => (
                <div
                  key={a.id}
                  onClick={() => navigate(`/applications/${a.id}`)}
                  className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-1.5 -mx-1.5 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.company}</div>
                    <div className="text-xs text-slate-500">{a.job_title}</div>
                  </div>
                  <div className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                    {formatDate(a.interview_date, 'MMM d')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Breakdown */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Pipeline by Status</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusBreakdown} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="status" width={130} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(v: number) => [v, 'Applications']}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {statusBreakdown.map((_, i) => (
                  <Cell key={i} fill={STATUS_CHART_COLORS[i % STATUS_CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By Source */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Applications by Source</h2>
          {bySource.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={bySource} dataKey="count" nameKey="source"
                  cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                >
                  {bySource.map((_, i) => (
                    <Cell key={i} fill={STATUS_CHART_COLORS[i % STATUS_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">No source data</div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Activity</h2>
          <button onClick={() => navigate('/applications')} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-2">
          {recentActivity.slice(0, 8).map(a => (
            <div
              key={a.id}
              className="flex items-center gap-3 py-1.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              onClick={() => navigate(`/applications/${a.application_id}`)}
            >
              <div className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT_COLORS[a.status as ApplicationStatus] || 'bg-slate-400')} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.company}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400"> — {a.job_title}</span>
              </div>
              <StatusBadge status={a.status as ApplicationStatus} size="sm" />
              <span className="text-xs text-slate-400 flex-shrink-0">{formatRelative(a.created_at)}</span>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <div className="text-center py-8 text-sm text-slate-400">No activity yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
