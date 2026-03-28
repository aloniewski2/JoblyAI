import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getToday, getDailyBrief, getFollowupSuggestions } from '../lib/api';
import { AlertTriangle, Calendar, Bell, Mail, CheckCircle, ArrowRight, Sparkles, Loader2, Copy, Flame } from 'lucide-react';
import StatusBadge from '../components/applications/StatusBadge';
import { formatDate, formatRelative, cn } from '../lib/utils';
import { EMAIL_CLASSIFICATION_COLORS, EMAIL_CLASSIFICATION_LABELS, type ApplicationStatus } from '../types';
import axios from 'axios';

const SectionHeader = ({ icon: Icon, title, count, color }: {
  icon: React.ElementType; title: string; count?: number; color: string;
}) => (
  <div className="flex items-center gap-2 mb-3">
    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
      <Icon className="w-3.5 h-3.5" />
    </div>
    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
    {count !== undefined && (
      <span className="ml-auto text-xs text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
        {count}
      </span>
    )}
  </div>
);

type FollowupSuggestion = {
  app_id: number;
  subject: string;
  body: string;
  company: string;
  job_title: string;
  recruiter_email?: string;
};

export default function Today() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [briefOpen, setBriefOpen] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<FollowupSuggestion[]>([]);
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['today'], queryFn: getToday });
  const { data: briefData, isLoading: briefLoading } = useQuery({
    queryKey: ['daily-brief'],
    queryFn: getDailyBrief,
    staleTime: 1000 * 60 * 30 // cache for 30 mins
  });

  const completeFollowUp = async (followUpId: number) => {
    try {
      await axios.patch(`/api/applications/followup/${followUpId}`, { completed: true });
      qc.invalidateQueries({ queryKey: ['today'] });
      toast.success('Follow-up marked done');
    } catch {
      toast.error('Failed');
    }
  };

  const generateFollowupSuggestions = async () => {
    const appIds = (data?.noResponse7 || []).slice(0, 5).map((a: { id: number }) => a.id);
    if (!appIds.length) return;
    setSuggestionsLoading(true);
    try {
      const result = await getFollowupSuggestions(appIds);
      setSuggestions(result.suggestions);
      if (result.suggestions.length) setExpandedSuggestion(result.suggestions[0].app_id);
      toast.success(`Generated ${result.suggestions.length} follow-up draft${result.suggestions.length !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to generate suggestions');
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Loading today's view…</div>
    </div>
  );

  const { followUpsDue = [], upcomingInterviews = [], noResponse7 = [], recentEmails = [] } = data || {};

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const isEmpty = followUpsDue.length === 0 && upcomingInterviews.length === 0 && noResponse7.length === 0 && recentEmails.length === 0;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Today</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{today}</p>
        </div>
        {(briefData?.meta?.streak ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-3 py-1.5 rounded-full text-sm font-semibold">
            <Flame className="w-4 h-4" />
            {briefData?.meta?.streak} day streak
          </div>
        )}
      </div>

      {/* Daily Brief */}
      <div className="card p-5 border-l-4 border-l-primary-400">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-500" />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Morning Brief</span>
          </div>
          <button
            onClick={() => setBriefOpen(v => !v)}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {briefOpen ? 'hide' : 'show'}
          </button>
        </div>
        {briefOpen && (
          briefLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating your briefing…
            </div>
          ) : briefData?.brief ? (
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{briefData.brief}</p>
          ) : (
            <p className="text-sm text-slate-400">Could not generate brief — check your AI provider in Settings.</p>
          )
        )}
      </div>

      {isEmpty && (
        <div className="card p-12 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">All caught up!</div>
          <div className="text-xs text-slate-400 mt-1">No follow-ups or actions needed today.</div>
        </div>
      )}

      {/* Follow-ups */}
      {followUpsDue.length > 0 && (
        <div className="card p-5">
          <SectionHeader icon={Bell} title="Follow-ups Due" count={followUpsDue.length} color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
          <div className="space-y-2">
            {followUpsDue.map((fu: {id: number; application_id: number; company: string; job_title: string; due_date: string; notes: string; status: ApplicationStatus}) => (
              <div key={fu.id} className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 group">
                <button
                  onClick={() => completeFollowUp(fu.id)}
                  className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex-shrink-0 transition-colors"
                />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/applications/${fu.application_id}`)}>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{fu.company}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{fu.job_title}</div>
                  {fu.notes && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{fu.notes}</div>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {fu.status && <StatusBadge status={fu.status} size="sm" />}
                  <span className={cn(
                    'text-xs font-medium',
                    new Date(fu.due_date) < new Date() ? 'text-red-600 dark:text-red-400' : 'text-slate-500'
                  )}>
                    {formatDate(fu.due_date, 'MMM d')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Interviews */}
      {upcomingInterviews.length > 0 && (
        <div className="card p-5">
          <SectionHeader icon={Calendar} title="Upcoming Interviews" count={upcomingInterviews.length} color="bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400" />
          <div className="space-y-3">
            {upcomingInterviews.map((interview: {id: number; company: string; job_title: string; interview_date: string; status: string; recruiter_name: string}) => (
              <div
                key={interview.id}
                onClick={() => navigate(`/applications/${interview.id}`)}
                className="flex items-center gap-3 p-3 rounded-xl bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 cursor-pointer hover:border-primary-300 transition-colors"
              >
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{interview.company}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{interview.job_title}</div>
                  {interview.recruiter_name && (
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">With {interview.recruiter_name}</div>
                  )}
                </div>
                <div className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                  {formatDate(interview.interview_date, 'MMM d')}
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Response — with AI follow-up generation */}
      {noResponse7.length > 0 && (
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <SectionHeader icon={AlertTriangle} title="No Response — Follow Up Recommended" count={noResponse7.length} color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">These applications have been in 'Applied' status for 7+ days with no response.</div>

          {/* AI Follow-up button */}
          {suggestions.length === 0 ? (
            <button
              onClick={generateFollowupSuggestions}
              disabled={suggestionsLoading}
              className="btn-secondary w-full mb-3 text-xs"
            >
              {suggestionsLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Drafting follow-up emails…</>
                : <><Sparkles className="w-3.5 h-3.5" /> Generate AI Follow-up Emails</>
              }
            </button>
          ) : null}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">AI-Drafted Follow-up Emails</div>
              {suggestions.map(s => (
                <div key={s.app_id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedSuggestion(expandedSuggestion === s.app_id ? null : s.app_id)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-left"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{s.company} — {s.job_title}</div>
                      <div className="text-xs text-slate-400 truncate max-w-xs">{s.subject}</div>
                    </div>
                    <ArrowRight className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', expandedSuggestion === s.app_id && 'rotate-90')} />
                  </button>
                  {expandedSuggestion === s.app_id && (
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Subject: <span className="font-medium text-slate-700 dark:text-slate-300">{s.subject}</span>
                        </div>
                        {s.recruiter_email && (
                          <div className="text-xs text-slate-400">To: {s.recruiter_email}</div>
                        )}
                      </div>
                      <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-800 rounded p-2">
                        {s.body}
                      </pre>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(`Subject: ${s.subject}\n\n${s.body}`)}
                          className="btn-secondary text-xs flex-1"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </button>
                        <a
                          href={`https://mail.google.com/mail/?view=cm&fs=1${s.recruiter_email ? `&to=${encodeURIComponent(s.recruiter_email)}` : ''}&su=${encodeURIComponent(s.subject)}&body=${encodeURIComponent(s.body)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary text-xs flex-1 flex items-center justify-center gap-1.5"
                        >
                          <Mail className="w-3.5 h-3.5" /> Open in Gmail
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {noResponse7.slice(0, 5).map((app: {id: number; company: string; job_title: string; application_date: string; days_since: number}) => (
              <div
                key={app.id}
                onClick={() => navigate(`/applications/${app.id}`)}
                className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer group"
              >
                <div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{app.company}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{app.job_title} · Applied {formatDate(app.application_date, 'MMM d')}</div>
                </div>
                <span className={cn(
                  'text-xs font-semibold px-2.5 py-1 rounded-full',
                  app.days_since >= 21 ? 'bg-red-100 text-red-700' :
                    app.days_since >= 14 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                )}>
                  {app.days_since}d no response
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Emails */}
      {recentEmails.length > 0 && (
        <div className="card p-5">
          <SectionHeader icon={Mail} title="Recent Email Activity" count={recentEmails.length} color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400" />
          <div className="space-y-2">
            {recentEmails.map((email: {id: number; application_id: number | null; subject: string; sender: string; classification: string; received_at: string; company?: string}) => (
              <div
                key={email.id}
                onClick={() => email.application_id && navigate(`/applications/${email.application_id}`)}
                className={cn('flex gap-3 py-2 border-b border-slate-50 dark:border-slate-800 last:border-0', email.application_id ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-2 -mx-2 transition-colors' : '')}
              >
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 self-start mt-0.5', EMAIL_CLASSIFICATION_COLORS[email.classification as keyof typeof EMAIL_CLASSIFICATION_COLORS] || 'bg-slate-100 text-slate-600')}>
                  {EMAIL_CLASSIFICATION_LABELS[email.classification as keyof typeof EMAIL_CLASSIFICATION_LABELS] || email.classification}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-700 dark:text-slate-300 truncate">{email.subject}</div>
                  <div className="text-xs text-slate-400">
                    {email.company ? `${email.company} · ` : ''}{email.sender} · {formatRelative(email.received_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
