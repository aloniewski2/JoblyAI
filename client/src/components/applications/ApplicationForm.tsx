import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createApplication, updateApplication } from '../../lib/api';
import { ALL_STATUSES, PRIORITY_COLORS, type Application } from '../../types';
import { SOURCES, cn } from '../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getResumes } from '../../lib/api';

interface Props {
  initial?: Partial<Application>;
  onSave: (app: Application) => void;
  onCancel: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  company: 'Company *', job_title: 'Job Title', application_link: 'Job URL',
  location: 'Location', salary_range: 'Salary Range', application_date: 'Application Date',
  status: 'Status', source: 'Source', priority: 'Priority',
  resume_version_id: 'Resume Version', recruiter_name: 'Recruiter Name',
  recruiter_email: 'Recruiter Email', follow_up_date: 'Follow-up Date',
  interview_date: 'Interview Date', referral_used: 'Referral Used',
  compensation_notes: 'Compensation Notes', rejection_reason: 'Rejection Reason',
  cover_letter: 'Cover Letter Notes', notes: 'Notes', job_description: 'Job Description'
};

export default function ApplicationForm({ initial = {}, onSave, onCancel }: Props) {
  const [form, setForm] = useState<Partial<Application>>({
    company: '', job_title: '', application_link: '', job_description: '',
    location: '', salary_range: '', application_date: new Date().toISOString().split('T')[0],
    status: 'Interested', source: 'LinkedIn', priority: 'medium',
    resume_version_id: null, cover_letter: '', recruiter_name: '',
    recruiter_email: '', follow_up_date: null, interview_date: null,
    notes: '', compensation_notes: '', referral_used: false, rejection_reason: '',
    ...initial
  });
  const [saving, setSaving] = useState(false);

  const { data: resumes = [] } = useQuery({ queryKey: ['resumes'], queryFn: getResumes });
  const qc = useQueryClient();

  const set = (key: keyof Application, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.company?.trim()) { toast.error('Company name is required'); return; }

    setSaving(true);
    try {
      const saved = initial.id
        ? await updateApplication(initial.id, form)
        : await createApplication(form);

      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(initial.id ? 'Application updated' : 'Application added');
      onSave(saved);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'input';
  const labelClass = 'label';

  return (
    <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
      {/* Row 1 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Company *</label>
          <input className={inputClass} value={form.company || ''} onChange={e => set('company', e.target.value)} placeholder="e.g. McKinsey & Company" required />
        </div>
        <div>
          <label className={labelClass}>Job Title</label>
          <input className={inputClass} value={form.job_title || ''} onChange={e => set('job_title', e.target.value)} placeholder="e.g. Senior Associate" />
        </div>
      </div>

      {/* Row 2 */}
      <div>
        <label className={labelClass}>Job URL</label>
        <input className={inputClass} type="url" value={form.application_link || ''} onChange={e => set('application_link', e.target.value)} placeholder="https://..." />
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Location</label>
          <input className={inputClass} value={form.location || ''} onChange={e => set('location', e.target.value)} placeholder="New York, NY" />
        </div>
        <div>
          <label className={labelClass}>Salary Range</label>
          <input className={inputClass} value={form.salary_range || ''} onChange={e => set('salary_range', e.target.value)} placeholder="$150k – $200k" />
        </div>
      </div>

      {/* Row 4 */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={e => set('status', e.target.value)}>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Priority</label>
          <select className={inputClass} value={form.priority} onChange={e => set('priority', e.target.value)}>
            {['high', 'medium', 'low'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Application Date</label>
          <input className={inputClass} type="date" value={form.application_date || ''} onChange={e => set('application_date', e.target.value)} />
        </div>
      </div>

      {/* Row 5 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Source</label>
          <select className={inputClass} value={form.source || ''} onChange={e => set('source', e.target.value)}>
            <option value="">Select source…</option>
            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Resume Version</label>
          <select className={inputClass} value={form.resume_version_id ?? ''} onChange={e => set('resume_version_id', e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">No resume linked</option>
            {resumes.map(r => <option key={r.id} value={r.id}>{r.name}{r.is_master ? ' ★' : ''}</option>)}
          </select>
        </div>
      </div>

      {/* Row 6 - Recruiter */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Recruiter Name</label>
          <input className={inputClass} value={form.recruiter_name || ''} onChange={e => set('recruiter_name', e.target.value)} placeholder="Jane Smith" />
        </div>
        <div>
          <label className={labelClass}>Recruiter Email</label>
          <input className={inputClass} type="email" value={form.recruiter_email || ''} onChange={e => set('recruiter_email', e.target.value)} placeholder="jane@company.com" />
        </div>
      </div>

      {/* Row 7 - Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Follow-up Date</label>
          <input className={inputClass} type="date" value={form.follow_up_date || ''} onChange={e => set('follow_up_date', e.target.value || null)} />
        </div>
        <div>
          <label className={labelClass}>Interview Date</label>
          <input className={inputClass} type="date" value={form.interview_date || ''} onChange={e => set('interview_date', e.target.value || null)} />
        </div>
      </div>

      {/* Row 8 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Compensation Notes</label>
          <input className={inputClass} value={form.compensation_notes || ''} onChange={e => set('compensation_notes', e.target.value)} placeholder="Equity, bonus details…" />
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.referral_used} onChange={e => set('referral_used', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Referral Used</span>
          </label>
        </div>
      </div>

      {/* Cover letter notes */}
      <div>
        <label className={labelClass}>Cover Letter Notes</label>
        <input className={inputClass} value={form.cover_letter || ''} onChange={e => set('cover_letter', e.target.value)} placeholder="e.g. Tailored for strategy focus" />
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes</label>
        <textarea className={cn(inputClass, 'h-20 resize-none')} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Interview notes, impressions, next steps…" />
      </div>

      {/* Job description */}
      <div>
        <label className={labelClass}>Job Description</label>
        <textarea className={cn(inputClass, 'h-32 resize-none font-mono text-xs')} value={form.job_description || ''} onChange={e => set('job_description', e.target.value)} placeholder="Paste the full job description here…" />
      </div>

      {/* Rejection reason — only show if rejected */}
      {form.status === 'Rejected' && (
        <div>
          <label className={labelClass}>Rejection Reason</label>
          <input className={inputClass} value={form.rejection_reason || ''} onChange={e => set('rejection_reason', e.target.value)} placeholder="e.g. Not enough experience, internal candidate" />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : initial.id ? 'Save Changes' : 'Add Application'}
        </button>
      </div>
    </form>
  );
}
