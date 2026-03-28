import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Sparkles, Loader2, Trophy, TrendingUp, DollarSign, CheckCircle, XCircle, Lightbulb } from 'lucide-react';
import Modal from './Modal';
import { getApplications, aiCompareOffers } from '../../lib/api';
import { cn } from '../../lib/utils';

type CompareResult = {
  recommendation: string;
  recommendation_reason: string;
  overall_summary: string;
  offers: Array<{
    app_id: number;
    company: string;
    job_title: string;
    pros: string[];
    cons: string[];
    comp_score: number;
    growth_score: number;
    fit_score: number;
    verdict: string;
  }>;
  negotiation_tip: string;
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
        <span>{label}</span>
        <span className="font-medium">{score}</span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function OfferComparisonModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);

  const { data } = useQuery({
    queryKey: ['applications', { status: 'Offer' }],
    queryFn: () => getApplications({ status: 'Offer', sort: 'updated_at', order: 'DESC' })
  });

  const offers = data?.applications || [];

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const runComparison = async () => {
    if (selected.size < 2) {
      toast.error('Select at least 2 offers to compare');
      return;
    }
    setLoading(true);
    try {
      const res = await aiCompareOffers([...selected]);
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI unavailable';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Compare Offers" onClose={onClose} size="2xl">
      <div className="px-6 py-5 space-y-5">
        {!result ? (
          <>
            {offers.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No applications with "Offer" status found. Update an application's status to Offer first.
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Select 2 or more offers to get an AI-powered side-by-side analysis with a recommendation.
                </p>
                <div className="space-y-2">
                  {offers.map(app => (
                    <div
                      key={app.id}
                      onClick={() => toggle(app.id)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                        selected.has(app.id)
                          ? 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                        selected.has(app.id)
                          ? 'border-violet-500 bg-violet-500'
                          : 'border-slate-300 dark:border-slate-600'
                      )}>
                        {selected.has(app.id) && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{app.company}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{app.job_title}</div>
                      </div>
                      {app.salary_range && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">{app.salary_range}</div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={runComparison}
                  disabled={loading || selected.size < 2}
                  className="btn-primary w-full"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing offers…</>
                    : <><Sparkles className="w-4 h-4" /> Compare {selected.size >= 2 ? selected.size : ''} Offers</>
                  }
                </button>
              </>
            )}
          </>
        ) : (
          <div className="space-y-5">
            {/* Recommendation banner */}
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 mb-1.5">
                <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  Recommended: {result.recommendation}
                </span>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">{result.recommendation_reason}</p>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400">{result.overall_summary}</p>

            {/* Per-offer breakdown */}
            <div className="grid grid-cols-1 gap-4">
              {result.offers.map(offer => {
                const isRecommended = offer.company === result.recommendation;
                return (
                  <div key={offer.app_id} className={cn(
                    'rounded-xl border p-4 space-y-3',
                    isRecommended
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10'
                      : 'border-slate-200 dark:border-slate-700'
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          {offer.company}
                          {isRecommended && <Trophy className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{offer.job_title}</div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <ScoreBar label="Compensation" score={offer.comp_score} />
                      <ScoreBar label="Growth Potential" score={offer.growth_score} />
                      <ScoreBar label="Role Fit" score={offer.fit_score} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Pros
                        </div>
                        <ul className="space-y-0.5">
                          {offer.pros.map((p, i) => (
                            <li key={i} className="text-xs text-slate-600 dark:text-slate-400">• {p}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Cons
                        </div>
                        <ul className="space-y-0.5">
                          {offer.cons.map((c, i) => (
                            <li key={i} className="text-xs text-slate-600 dark:text-slate-400">• {c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">{offer.verdict}</p>
                  </div>
                );
              })}
            </div>

            {/* Negotiation tip */}
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-0.5">Negotiation Tip</div>
                <div className="text-xs text-amber-700 dark:text-amber-400">{result.negotiation_tip}</div>
              </div>
            </div>

            <button onClick={() => setResult(null)} className="btn-secondary w-full text-xs">
              ← Compare Different Offers
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
