import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Sparkles, Loader2, CheckCircle, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';
import { aiIntake, createApplication } from '../../lib/api';
import Modal from './Modal';
import { cn } from '../../lib/utils';

type IntakeResult = {
  extracted: {
    company?: string;
    job_title?: string;
    location?: string;
    salary_range?: string;
    job_description?: string;
  };
  match: {
    fit_score: number;
    recommendation: string;
    recommendation_reason: string;
    summary: string;
    strengths: string[];
    gaps: string[];
    apply_tip: string;
  } | null;
  hasResume: boolean;
};

const REC_STYLES: Record<string, string> = {
  Apply: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  Consider: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  Skip: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
};

const REC_ICONS: Record<string, React.ElementType> = {
  Apply: CheckCircle,
  Consider: AlertTriangle,
  Skip: XCircle,
};

export default function IntakeModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<IntakeResult | null>(null);

  const runIntake = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await aiIntake(text);
      setResult(data);
    } catch {
      toast.error('Intake failed — check AI provider in Settings');
    } finally {
      setLoading(false);
    }
  };

  const saveApplication = async () => {
    if (!result?.extracted) return;
    setSaving(true);
    try {
      await createApplication({
        company: result.extracted.company || '',
        job_title: result.extracted.job_title || '',
        location: result.extracted.location || '',
        salary_range: result.extracted.salary_range || '',
        job_description: result.extracted.job_description || '',
        status: 'Interested',
      });
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Added ${result.extracted.company} to your pipeline`);
      onClose();
    } catch {
      toast.error('Failed to save application');
    } finally {
      setSaving(false);
    }
  };

  const match = result?.match;
  const RecIcon = match ? (REC_ICONS[match.recommendation] || ChevronRight) : null;
  const scoreColor = match
    ? match.fit_score >= 80 ? 'text-emerald-600' : match.fit_score >= 60 ? 'text-amber-600' : 'text-red-600'
    : '';

  return (
    <Modal title="Quick Job Intake" onClose={onClose} size="xl">
      <div className="px-6 py-5 space-y-5">
        {!result ? (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Paste a job description or full posting text. JoblyAI will extract the details, evaluate fit against your profile, and recommend whether to apply.
            </p>
            <textarea
              className="w-full h-48 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Paste the job posting here…"
              value={text}
              onChange={e => setText(e.target.value)}
            />
            <button
              onClick={runIntake}
              disabled={loading || !text.trim()}
              className="btn-primary w-full"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing job…</>
                : <><Sparkles className="w-4 h-4" /> Analyze & Evaluate</>
              }
            </button>
          </>
        ) : (
          <>
            {/* Extracted info */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-1">
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {result.extracted.company || 'Unknown Company'}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {result.extracted.job_title || 'Unknown Role'}
                {result.extracted.location ? ` · ${result.extracted.location}` : ''}
                {result.extracted.salary_range ? ` · ${result.extracted.salary_range}` : ''}
              </div>
            </div>

            {/* Match result */}
            {match ? (
              <div className={cn('rounded-xl border p-4 space-y-3', REC_STYLES[match.recommendation] || REC_STYLES.Consider)}>
                <div className="flex items-center gap-3">
                  {RecIcon && <RecIcon className="w-5 h-5 flex-shrink-0" />}
                  <div>
                    <div className="font-semibold text-sm">{match.recommendation}</div>
                    <div className="text-xs opacity-80">{match.recommendation_reason}</div>
                  </div>
                  <div className={cn('ml-auto text-2xl font-bold', scoreColor)}>{match.fit_score}%</div>
                </div>

                <p className="text-sm opacity-90">{match.summary}</p>

                {match.strengths?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold mb-1 opacity-70">Strengths</div>
                    <ul className="space-y-0.5">
                      {match.strengths.map((s, i) => (
                        <li key={i} className="text-xs flex gap-1.5"><span className="opacity-60">✓</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {match.gaps?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold mb-1 opacity-70">Gaps</div>
                    <ul className="space-y-0.5">
                      {match.gaps.map((g, i) => (
                        <li key={i} className="text-xs flex gap-1.5"><span className="opacity-60">△</span>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {match.apply_tip && (
                  <div className="text-xs border-t border-current border-opacity-20 pt-2 opacity-80">
                    <span className="font-semibold">Tip: </span>{match.apply_tip}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-400 text-center py-3">
                {result.hasResume ? 'Could not generate match analysis.' : 'Upload a master resume in Resumes for fit scoring.'}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setResult(null)} className="btn-secondary flex-1">
                Try Another
              </button>
              <button onClick={saveApplication} disabled={saving} className="btn-primary flex-1">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Add to Pipeline'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
