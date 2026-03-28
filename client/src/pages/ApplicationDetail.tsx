import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ExternalLink, Edit2, Trash2, MapPin, DollarSign,
  User, Mail, Calendar, Clock, FileText, Star, Tag,
  Loader2, Sparkles, ChevronDown, ChevronUp, Send, Copy, MessageSquare, Plus, X, Users
} from 'lucide-react';
import {
  getApplication, getStatusHistory, getApplicationEmails,
  updateStatus, deleteApplication, aiMatch, aiSummarize, aiInterviewPrep,
  aiCoverLetter, aiTailorResume, downloadResumeUrl, getResumes,
  getInterviewQuestions, addInterviewQuestion, deleteInterviewQuestion,
  getApplicationConnections, aiWarmIntro,
  type InterviewQuestion, type Contact
} from '../lib/api';
import StatusBadge from '../components/applications/StatusBadge';
import Modal from '../components/ui/Modal';
import MarkdownText from '../components/ui/MarkdownText';
import ApplicationForm from '../components/applications/ApplicationForm';
import { ALL_STATUSES, PRIORITY_COLORS, EMAIL_CLASSIFICATION_COLORS, EMAIL_CLASSIFICATION_LABELS, type ApplicationStatus } from '../types';
import { formatDate, formatRelative, cn } from '../lib/utils';

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const appId = parseInt(id!);

  const [showEdit, setShowEdit] = useState(false);
  const [showJD, setShowJD] = useState(false);
  const [loadingTool, setLoadingTool] = useState<'match' | 'summary' | 'prep' | 'cover' | 'tailor' | null>(null);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [prepResult, setPrepResult] = useState('');
  const [summaryResult, setSummaryResult] = useState('');
  const [coverLetterResult, setCoverLetterResult] = useState('');
  const [coverLetterTone, setCoverLetterTone] = useState<'professional' | 'enthusiastic' | 'concise'>('professional');
  const [tailorResult, setTailorResult] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [networkDrafts, setNetworkDrafts] = useState<Record<number, string>>({});
  const [draftingId, setDraftingId] = useState<number | null>(null);
  const [showAddQ, setShowAddQ] = useState(false);
  const [newQRound, setNewQRound] = useState('');
  const [newQQuestion, setNewQQuestion] = useState('');
  const [newQAnswer, setNewQAnswer] = useState('');
  const [autoPrepLoading, setAutoPrepLoading] = useState(false);

  const { data: app, isLoading } = useQuery({ queryKey: ['application', appId], queryFn: () => getApplication(appId) });
  const { data: history = [] } = useQuery({ queryKey: ['status-history', appId], queryFn: () => getStatusHistory(appId) });
  const { data: emails = [] } = useQuery({ queryKey: ['app-emails', appId], queryFn: () => getApplicationEmails(appId) });
  const { data: resumes = [] } = useQuery({ queryKey: ['resumes'], queryFn: getResumes });
  const { data: connections = [] } = useQuery({
    queryKey: ['app-connections', appId],
    queryFn: () => getApplicationConnections(appId)
  });

  const { data: questions = [], refetch: refetchQ } = useQuery({
    queryKey: ['interview-questions', appId],
    queryFn: () => getInterviewQuestions(appId)
  });

  const INTERVIEW_STAGES = new Set(['Recruiter Screen', 'Interview Round 1', 'Interview Round 2', 'Final Round']);

  const handleStatusChange = async (status: string) => {
    const isInterview = INTERVIEW_STAGES.has(status);
    if (isInterview) setAutoPrepLoading(true);
    try {
      const result = await updateStatus(appId, status);
      qc.invalidateQueries({ queryKey: ['application', appId] });
      qc.invalidateQueries({ queryKey: ['status-history', appId] });
      qc.invalidateQueries({ queryKey: ['applications'] });
      toast.success(`Status → ${status}`);

      if (result.interview_prep) {
        setPrepResult(result.interview_prep);
        toast.success('Interview prep ready — scroll down', { icon: '✨', duration: 3000 });
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setAutoPrepLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this application?')) return;
    await deleteApplication(appId);
    qc.invalidateQueries({ queryKey: ['applications'] });
    navigate('/applications');
    toast.success('Deleted');
  };

  const runAIMatch = async () => {
    if (!app) return;
    setLoadingTool('match');
    try {
      const linkedResume = resumes.find(r => r.id === app.resume_version_id);
      const resumeToUse = linkedResume || resumes[0];
      const result = await aiMatch({
        job_description: app.job_description,
        job_title: app.job_title,
        company: app.company,
        resume_id: resumeToUse?.id,
      });
      setAiResult(result as Record<string, unknown>);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI unavailable');
    } finally {
      setLoadingTool(null);
    }
  };

  const runSummary = async () => {
    if (!app) return;
    setLoadingTool('summary');
    try {
      const result = await aiSummarize(app.job_description, app.job_title, app.company);
      setSummaryResult(result.summary);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI unavailable');
    } finally {
      setLoadingTool(null);
    }
  };

  const runPrep = async () => {
    if (!app) return;
    setLoadingTool('prep');
    try {
      const result = await aiInterviewPrep(app.job_title, app.company, app.job_description);
      setPrepResult(result.prep);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI unavailable');
    } finally {
      setLoadingTool(null);
    }
  };

  const runTailorResume = async () => {
    if (!app) return;
    setLoadingTool('tailor');
    try {
      const result = await aiTailorResume(app.id, resumeText, selectedResumeId ?? undefined);
      setTailorResult(result.tailored_resume);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI unavailable');
    } finally {
      setLoadingTool(null);
    }
  };

  const draftIntro = async (contactId: number) => {
    setDraftingId(contactId);
    try {
      const result = await aiWarmIntro(appId, contactId);
      setNetworkDrafts(d => ({ ...d, [contactId]: result.message }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI unavailable');
    } finally {
      setDraftingId(null);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQQuestion.trim()) return;
    await addInterviewQuestion(appId, { round: newQRound, question: newQQuestion, answer: newQAnswer });
    setNewQQuestion(''); setNewQAnswer(''); setNewQRound(''); setShowAddQ(false);
    refetchQ();
  };

  const handleDeleteQuestion = async (qid: number) => {
    await deleteInterviewQuestion(appId, qid);
    refetchQ();
  };

  const runCoverLetter = async () => {
    if (!app) return;
    setLoadingTool('cover');
    try {
      const result = await aiCoverLetter(app.id, coverLetterTone);
      setCoverLetterResult(result.cover_letter);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'AI unavailable');
    } finally {
      setLoadingTool(null);
    }
  };

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );
  if (!app) return <div className="p-8 text-slate-500">Application not found</div>;

  const linkedResume = resumes.find(r => r.id === app.resume_version_id);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/applications')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 mt-0.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{app.company}</h1>
              <div className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{app.job_title}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {app.application_link && (
                <a href={app.application_link} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                  <ExternalLink className="w-4 h-4" /> View Job
                </a>
              )}
              <button onClick={() => setShowEdit(true)} className="btn-secondary">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button onClick={handleDelete} className="btn-ghost text-red-500 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status + Priority row */}
          <div className="flex items-center gap-3 mt-3">
            <div className="relative flex items-center">
              <select
                className="text-sm font-medium rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                value={app.status}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={autoPrepLoading}
              >
              {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {autoPrepLoading && (
                <div className="absolute -right-6 flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-500" />
                </div>
              )}
            </div>
            <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', PRIORITY_COLORS[app.priority])}>
              {app.priority} priority
            </span>
            {app.referral_used && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                Referral
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-5 gap-5">
        {/* Left column — main info */}
        <div className="col-span-3 space-y-4">
          {/* Key Details */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Role Details</h2>
            <div className="grid grid-cols-2 gap-4">
              {app.location && (
                <Detail icon={MapPin} label="Location" value={app.location} />
              )}
              {app.salary_range && (
                <Detail icon={DollarSign} label="Salary Range" value={app.salary_range} />
              )}
              {app.application_date && (
                <Detail icon={Calendar} label="Applied" value={formatDate(app.application_date)} />
              )}
              {app.source && (
                <Detail icon={Tag} label="Source" value={app.source} />
              )}
              {app.follow_up_date && (
                <Detail icon={Clock} label="Follow-up" value={formatDate(app.follow_up_date)} warn={new Date(app.follow_up_date) < new Date()} />
              )}
              {app.interview_date && (
                <Detail icon={Calendar} label="Interview" value={formatDate(app.interview_date)} />
              )}
              {linkedResume && (
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Resume</div>
                    <a href={downloadResumeUrl(linkedResume.id)} className="text-sm text-primary-600 hover:underline">
                      {linkedResume.name}
                    </a>
                  </div>
                </div>
              )}
              {app.cover_letter && (
                <Detail icon={FileText} label="Cover Letter" value={app.cover_letter} />
              )}
            </div>

            {app.compensation_notes && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Compensation Notes</div>
                <div className="text-sm text-slate-700 dark:text-slate-300">{app.compensation_notes}</div>
              </div>
            )}
          </div>

          {/* Recruiter */}
          {(app.recruiter_name || app.recruiter_email) && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Recruiter</h2>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-500">
                  {app.recruiter_name?.charAt(0) || '?'}
                </div>
                <div>
                  {app.recruiter_name && <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{app.recruiter_name}</div>}
                  {app.recruiter_email && (
                    <a href={`mailto:${app.recruiter_email}`} className="text-sm text-primary-600 hover:underline flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />{app.recruiter_email}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {app.notes && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Notes</h2>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{app.notes}</p>
            </div>
          )}

          {/* Job Description */}
          {app.job_description && (
            <div className="card p-5">
              <button
                onClick={() => setShowJD(v => !v)}
                className="flex items-center justify-between w-full"
              >
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Job Description</h2>
                {showJD ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showJD && (
                <div className="mt-3 text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                  {app.job_description}
                </div>
              )}
            </div>
          )}

          {/* Email Activity */}
          {emails.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Email Activity</h2>
              <div className="space-y-3">
                {emails.map(email => (
                  <div key={email.id} className="flex gap-3 py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                    <div className="flex-shrink-0 mt-0.5">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', EMAIL_CLASSIFICATION_COLORS[email.classification] || 'bg-slate-100 text-slate-600')}>
                        {EMAIL_CLASSIFICATION_LABELS[email.classification] || email.classification}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{email.subject}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{email.sender} · {formatRelative(email.received_at)}</div>
                      {email.body_preview && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{email.body_preview}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Interview Questions */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-400" />
                Interview Questions
                {questions.length > 0 && (
                  <span className="text-xs font-normal text-slate-400">({questions.length})</span>
                )}
              </h2>
              <button
                onClick={() => setShowAddQ(v => !v)}
                className="btn-ghost text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {showAddQ && (
              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2">
                <select
                  className="input w-full text-sm"
                  value={newQRound}
                  onChange={e => setNewQRound(e.target.value)}
                >
                  <option value="">Round / Stage (optional)</option>
                  <option>Recruiter Screen</option>
                  <option>Interview Round 1</option>
                  <option>Interview Round 2</option>
                  <option>Final Round</option>
                </select>
                <textarea
                  className="input w-full text-sm"
                  rows={2}
                  placeholder="Question asked…"
                  value={newQQuestion}
                  onChange={e => setNewQQuestion(e.target.value)}
                  autoFocus
                />
                <textarea
                  className="input w-full text-sm"
                  rows={2}
                  placeholder="Your answer / notes (optional)…"
                  value={newQAnswer}
                  onChange={e => setNewQAnswer(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={handleAddQuestion} disabled={!newQQuestion.trim()} className="btn-primary text-xs flex-1">
                    Save Question
                  </button>
                  <button onClick={() => setShowAddQ(false)} className="btn-ghost text-xs">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {questions.length === 0 && !showAddQ && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Log questions asked in each round to build your prep bank.
              </p>
            )}

            <div className="space-y-3">
              {(questions as InterviewQuestion[]).map(q => (
                <div key={q.id} className="group flex gap-3 py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    {q.round && (
                      <div className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-0.5">{q.round}</div>
                    )}
                    <div className="text-sm text-slate-700 dark:text-slate-300">{q.question}</div>
                    {q.answer && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">{q.answer}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — AI tools + status */}
        <div className="col-span-2 space-y-4">

          {/* ── AI Tools ── */}
          <div className="card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Tools</h2>
            </div>

            {/* Resume Match */}
            <div className="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Resume Match</span>
                {aiResult && <button onClick={() => setAiResult(null)} className="text-xs text-slate-400 hover:text-slate-600">↺</button>}
              </div>
              {!aiResult ? (
                <button onClick={runAIMatch} disabled={!!loadingTool} className="btn-primary w-full text-xs py-1.5">
                  {loadingTool === 'match' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…</> : <><Sparkles className="w-3.5 h-3.5" /> Analyze Fit</>}
                </button>
              ) : (
                <AIMatchResult result={aiResult} />
              )}
            </div>

            {/* Summarize JD */}
            <div className="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Summarize JD</span>
                {summaryResult && <button onClick={() => setSummaryResult('')} className="text-xs text-slate-400 hover:text-slate-600">↺</button>}
              </div>
              {!summaryResult ? (
                <button onClick={runSummary} disabled={!!loadingTool} className="btn-primary w-full text-xs py-1.5">
                  {loadingTool === 'summary' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Summarizing…</> : <><Sparkles className="w-3.5 h-3.5" /> Summarize</>}
                </button>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <MarkdownText text={summaryResult} />
                </div>
              )}
            </div>

            {/* Interview Prep */}
            <div className="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Interview Prep</span>
                {prepResult && <button onClick={() => setPrepResult('')} className="text-xs text-slate-400 hover:text-slate-600">↺</button>}
              </div>
              {!prepResult ? (
                <button onClick={runPrep} disabled={!!loadingTool} className="btn-primary w-full text-xs py-1.5">
                  {loadingTool === 'prep' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Sparkles className="w-3.5 h-3.5" /> Generate Prep</>}
                </button>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <MarkdownText text={prepResult} />
                </div>
              )}
            </div>

            {/* Cover Letter */}
            <div className="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cover Letter</span>
                {coverLetterResult && <button onClick={() => setCoverLetterResult('')} className="text-xs text-slate-400 hover:text-slate-600">↺</button>}
              </div>
              {!coverLetterResult ? (
                <>
                  <div className="flex gap-1">
                    {(['professional', 'enthusiastic', 'concise'] as const).map(t => (
                      <button key={t} onClick={() => setCoverLetterTone(t)}
                        className={cn('flex-1 py-1 text-xs rounded border capitalize transition-colors',
                          coverLetterTone === t
                            ? 'bg-violet-50 border-violet-300 text-violet-700 dark:bg-violet-900/20 dark:border-violet-700 dark:text-violet-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}>{t}</button>
                    ))}
                  </div>
                  <button onClick={runCoverLetter} disabled={!!loadingTool} className="btn-primary w-full text-xs py-1.5">
                    {loadingTool === 'cover' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Writing…</> : <><Sparkles className="w-3.5 h-3.5" /> Generate</>}
                  </button>
                </>
              ) : (
                <div className="space-y-1.5">
                  <textarea className="input w-full text-xs leading-relaxed" rows={8} value={coverLetterResult} onChange={e => setCoverLetterResult(e.target.value)} />
                  <button onClick={() => { navigator.clipboard.writeText(coverLetterResult); toast.success('Copied'); }} className="btn-secondary w-full text-xs">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
              )}
            </div>

            {/* Tailor Resume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tailor Resume</span>
                {tailorResult && <button onClick={() => setTailorResult('')} className="text-xs text-slate-400 hover:text-slate-600">↺</button>}
              </div>
              {!tailorResult ? (
                <>
                  {resumes.length > 0 && (
                    <select className="input w-full text-xs" value={selectedResumeId ?? ''}
                      onChange={e => { setSelectedResumeId(e.target.value ? Number(e.target.value) : null); setResumeText(''); }}>
                      <option value="">— Paste text below —</option>
                      {resumes.map(r => <option key={r.id} value={r.id}>{r.name}{r.is_master ? ' ★' : ''}</option>)}
                    </select>
                  )}
                  {(() => {
                    const sel = resumes.find(r => r.id === selectedResumeId);
                    return (!sel || !sel.hasText) ? (
                      <textarea className="input w-full font-mono text-xs" rows={5}
                        placeholder={sel ? `"${sel.name}" has no text — paste here…` : 'Paste resume (plain text)…'}
                        value={resumeText} onChange={e => setResumeText(e.target.value)} />
                    ) : (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">✓ Text loaded from "{sel.name}"</p>
                    );
                  })()}
                  <button onClick={runTailorResume}
                    disabled={!!loadingTool || (() => { const s = resumes.find(r => r.id === selectedResumeId); return s?.hasText ? false : resumeText.trim().length < 50; })()}
                    className="btn-primary w-full text-xs py-1.5">
                    {loadingTool === 'tailor' ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Tailoring…</> : <><Sparkles className="w-3.5 h-3.5" /> Tailor for this Role</>}
                  </button>
                </>
              ) : (
                <div className="space-y-1.5">
                  <textarea className="input w-full font-mono text-xs" rows={10} value={tailorResult} onChange={e => setTailorResult(e.target.value)} />
                  <button onClick={() => { navigator.clipboard.writeText(tailorResult); toast.success('Copied'); }} className="btn-secondary w-full text-xs">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Status Timeline</h2>
            <div className="relative">
              <div className="absolute left-2.5 top-3 bottom-3 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-4">
                {[...history].reverse().map((h, i) => (
                  <div key={h.id} className="flex gap-3 relative">
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 z-10',
                      i === 0
                        ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                    )} />
                    <div>
                      <StatusBadge status={h.status as ApplicationStatus} size="sm" />
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatRelative(h.created_at)}</div>
                      {h.notes && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{h.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Network at this company */}
          {(connections as Contact[]).length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                Network at {app.company}
                <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                  {(connections as Contact[]).length} connection{(connections as Contact[]).length !== 1 ? 's' : ''}
                </span>
              </h2>
              <div className="space-y-3">
                {(connections as Contact[]).map(c => {
                  const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.company;
                  const draft = networkDrafts[c.id];
                  const isDrafting = draftingId === c.id;
                  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1${c.email ? `&to=${encodeURIComponent(c.email)}` : ''}&su=${encodeURIComponent(`Quick question re: ${app.company}`)}&body=${encodeURIComponent(draft ?? '')}`;
                  return (
                    <div key={c.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex-shrink-0">
                          {c.first_name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{name}</div>
                          {c.position && <div className="text-xs text-slate-400 truncate">{c.position}</div>}
                        </div>
                        {!draft && (
                          <button
                            onClick={() => draftIntro(c.id)}
                            disabled={isDrafting}
                            className="flex-shrink-0 text-xs btn-secondary py-1 px-2"
                          >
                            {isDrafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sparkles className="w-3 h-3" /> Draft</>}
                          </button>
                        )}
                      </div>
                      {draft && (
                        <div className="space-y-1.5 pl-9">
                          <textarea
                            className="input w-full text-xs leading-relaxed font-normal"
                            rows={4}
                            value={draft}
                            onChange={e => setNetworkDrafts(d => ({ ...d, [c.id]: e.target.value }))}
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => { navigator.clipboard.writeText(draft); toast.success('Copied'); }}
                              className="btn-secondary text-xs py-1 flex-1"
                            >
                              <Copy className="w-3 h-3" /> Copy
                            </button>
                            {c.email && (
                              <a href={gmailUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs py-1 flex-1 text-center">
                                <Send className="w-3 h-3" /> Gmail
                              </a>
                            )}
                            <button
                              onClick={() => { setNetworkDrafts(d => { const n = {...d}; delete n[c.id]; return n; }); draftIntro(c.id); }}
                              className="btn-ghost text-xs py-1 text-slate-400"
                            >
                              ↺
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick status update */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Update Status</h2>
            <div className="space-y-1.5">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    app.status === s
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 ring-1 ring-primary-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <Modal title={`Edit — ${app.company}`} onClose={() => setShowEdit(false)} size="2xl">
          <ApplicationForm
            initial={app}
            onSave={() => { setShowEdit(false); qc.invalidateQueries({ queryKey: ['application', appId] }); }}
            onCancel={() => setShowEdit(false)}
          />
        </Modal>
      )}

    </div>
  );
}

function Detail({ icon: Icon, label, value, warn = false }: {
  icon: React.ElementType; label: string; value: string; warn?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', warn ? 'text-red-400' : 'text-slate-400')} />
      <div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
        <div className={cn('text-sm font-medium', warn ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200')}>
          {value}
        </div>
      </div>
    </div>
  );
}

function AIMatchResult({ result }: { result: Record<string, unknown> }) {
  const score = result.fit_score as number;
  const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={cn('text-4xl font-bold', scoreColor)}>{score}%</div>
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Fit Score</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{result.summary as string}</div>
        </div>
      </div>

      {(result.strengths as string[])?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Strengths</div>
          <ul className="space-y-1">
            {(result.strengths as string[]).map((s, i) => (
              <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex gap-2">
                <span className="text-emerald-500 flex-shrink-0">✓</span>{s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(result.gaps as string[])?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Gaps to Address</div>
          <ul className="space-y-1">
            {(result.gaps as string[]).map((g, i) => (
              <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex gap-2">
                <span className="text-amber-500 flex-shrink-0">△</span>{g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(result.missing_keywords as string[])?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Missing Keywords</div>
          <div className="flex flex-wrap gap-1.5">
            {(result.missing_keywords as string[]).map((k, i) => (
              <span key={i} className="text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">{k}</span>
            ))}
          </div>
        </div>
      )}

      {typeof result.networking_message === 'string' && result.networking_message && (
        <div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">LinkedIn Outreach</div>
          <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 italic">
            {String(result.networking_message)}
          </div>
        </div>
      )}
    </div>
  );
}
