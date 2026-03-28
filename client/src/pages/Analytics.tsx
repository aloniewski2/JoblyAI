import { useQuery } from '@tanstack/react-query';
import { Loader2, Download } from 'lucide-react';
import { getAnalytics } from '../lib/api';
import { cn } from '../lib/utils';

export default function Analytics() {
  const { data, isLoading } = useQuery({ queryKey: ['analytics'], queryFn: getAnalytics });

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  const f = data?.funnel;
  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));

  const funnelStages = [
    { label: 'Applied', count: f?.applied ?? 0 },
    { label: 'Recruiter Screen', count: f?.screened ?? 0 },
    { label: 'Interview', count: f?.interviewed ?? 0 },
    { label: 'Offer', count: f?.offered ?? 0 },
  ];
  const funnelBase = f?.applied ?? 1;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Analytics</h1>
        <a
          href="/api/applications/export"
          download
          className="btn-secondary text-sm"
        >
          <Download className="w-4 h-4" /> Export CSV
        </a>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Total Applications" value={f?.total ?? 0} />
        <MetricCard
          label="Response Rate"
          value={`${pct(f?.screened ?? 0, f?.applied ?? 0)}%`}
          sub="reached screening"
          highlight={(f?.screened ?? 0) > 0}
        />
        <MetricCard
          label="Interview Rate"
          value={`${pct(f?.interviewed ?? 0, f?.applied ?? 0)}%`}
          sub="reached interviews"
          highlight={(f?.interviewed ?? 0) > 0}
        />
        <MetricCard
          label="Offer Rate"
          value={`${pct(f?.offered ?? 0, f?.applied ?? 0)}%`}
          sub="of applications"
          highlight={(f?.offered ?? 0) > 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Funnel */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Application Funnel</h2>
          <div className="space-y-4">
            {funnelStages.map((stage, i) => {
              const width = pct(stage.count, funnelBase);
              return (
                <div key={stage.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-600 dark:text-slate-400">{stage.label}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {stage.count}
                      {i > 0 && funnelBase > 0 && (
                        <span className="font-normal text-slate-400 ml-1">({width}%)</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        i === 0 ? 'bg-primary-400' :
                        i === 1 ? 'bg-primary-500' :
                        i === 2 ? 'bg-primary-600' : 'bg-emerald-500'
                      )}
                      style={{ width: `${Math.max(width, stage.count > 0 ? 1 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {data?.avgDaysToInterview != null && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              Avg <span className="font-semibold text-slate-700 dark:text-slate-300">{data.avgDaysToInterview} days</span> from application to first response
            </div>
          )}
        </div>

        {/* Weekly volume */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Applications per Week (last 12 weeks)</h2>
          <WeeklyChart data={data?.weeklyVolume ?? []} />
        </div>
      </div>

      {/* Source breakdown */}
      {(data?.bySource.length ?? 0) > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">By Source</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="pb-2 text-left">Source</th>
                <th className="pb-2 text-right">Applications</th>
                <th className="pb-2 text-right">Interviews</th>
                <th className="pb-2 text-right">Offers</th>
                <th className="pb-2 text-right">Interview Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {data?.bySource.map(s => {
                const iRate = pct(s.reached_interview, s.total);
                return (
                  <tr key={s.source}>
                    <td className="py-2.5 text-slate-700 dark:text-slate-300 font-medium">{s.source}</td>
                    <td className="py-2.5 text-right text-slate-600 dark:text-slate-400">{s.total}</td>
                    <td className="py-2.5 text-right text-slate-600 dark:text-slate-400">{s.reached_interview}</td>
                    <td className="py-2.5 text-right text-emerald-600 dark:text-emerald-400 font-medium">{s.offers || '—'}</td>
                    <td className="py-2.5 text-right">
                      <span className={cn('font-semibold', iRate >= 20 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400')}>
                        {iRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Status breakdown */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Current Pipeline</h2>
        <div className="grid grid-cols-3 gap-2">
          {data?.statusBreakdown.filter(s => s.count > 0).map(s => (
            <div key={s.status} className="flex justify-between items-center px-3 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <span className="text-xs text-slate-600 dark:text-slate-400">{s.status}</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, highlight = false }: {
  label: string; value: string | number; sub?: string; highlight?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</div>
      <div className={cn(
        'text-2xl font-bold',
        highlight ? 'text-primary-600 dark:text-primary-400' : 'text-slate-900 dark:text-slate-100'
      )}>
        {value}
      </div>
      {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function WeeklyChart({ data }: { data: Array<{ week: string; count: number }> }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-32 text-sm text-slate-400">No data yet</div>
  );
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-32 pt-6">
      {data.map(d => {
        const heightPct = (d.count / max) * 100;
        return (
          <div key={d.week} className="flex-1 flex flex-col items-center gap-1 min-w-0 group relative">
            {d.count > 0 && (
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {d.count}
              </div>
            )}
            <div
              className="w-full bg-primary-200 dark:bg-primary-800 hover:bg-primary-400 dark:hover:bg-primary-600 rounded-t transition-colors"
              style={{ height: `${Math.max(heightPct, d.count > 0 ? 4 : 0)}%`, minHeight: d.count > 0 ? '4px' : '0' }}
            />
            <div className="text-[9px] text-slate-400 truncate w-full text-center">
              {`W${d.week.split('-W')[1] ?? d.week}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
