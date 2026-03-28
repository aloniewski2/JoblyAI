import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link, Loader2, Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '../ui/Modal';
import ApplicationForm from './ApplicationForm';
import { extractJobFromUrl, extractJobFromText } from '../../lib/api';
import type { Application } from '../../types';

interface Props {
  onClose: () => void;
}

type Step = 'input' | 'form';

export default function QuickAddModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('input');
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initial, setInitial] = useState<Partial<Application>>({});
  const [warning, setWarning] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const handleExtract = async () => {
    if (!url.trim() && !pastedText.trim()) {
      // Skip to empty form
      setStep('form');
      return;
    }

    setLoading(true);
    setWarning('');
    try {
      let result;
      if (url.trim()) {
        result = await extractJobFromUrl(url.trim());
      } else {
        result = await extractJobFromText(pastedText.trim());
      }

      if (result.warning) {
        setWarning(result.warning);
        // If we got a warning and nothing useful, open paste mode instead of advancing
        const e = result.extracted || {};
        if (!e.company && !e.job_title && !e.job_description) {
          setShowPaste(true);
          setLoading(false);
          return;
        }
      }

      const extracted = result.extracted || {};
      setInitial({
        ...extracted,
        application_link: url || (extracted as Partial<Application>).application_link || '',
        application_date: new Date().toISOString().split('T')[0],
        status: 'Applied',
        priority: 'medium',
      } as Partial<Application>);
      setStep('form');
    } catch {
      toast.error('Extraction failed. Fill in manually.');
      setInitial({
        application_link: url,
        application_date: new Date().toISOString().split('T')[0],
        status: 'Applied',
        priority: 'medium',
      });
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (app: Application) => {
    qc.invalidateQueries({ queryKey: ['applications'] });
    toast.success(`Added ${app.company}`);
    onClose();
  };

  if (step === 'form') {
    return (
      <Modal
        title={initial.company ? `Add — ${initial.company}` : 'Add Application'}
        onClose={onClose}
        size="2xl"
      >
        {warning && (
          <div className="mx-6 mt-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
            {warning}
          </div>
        )}
        <ApplicationForm
          initial={initial}
          onSave={handleSave}
          onCancel={onClose}
        />
      </Modal>
    );
  }

  return (
    <Modal title="Quick Add Application" onClose={onClose} size="md">
      <div className="px-6 py-5 space-y-5">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Paste a job URL to auto-extract details, or skip straight to the form.
          </p>

          <label className="label">Job URL</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={urlRef}
                type="url"
                className="input pl-9"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://linkedin.com/jobs/..."
                onKeyDown={e => e.key === 'Enter' && handleExtract()}
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Paste text alternative */}
        <div>
          <button
            type="button"
            onClick={() => setShowPaste(v => !v)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            {showPaste ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Or paste job description text
          </button>
          {showPaste && (
            <div className="mt-2">
              <textarea
                className="input h-28 resize-none text-xs mt-1"
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder="Paste the full job description here for AI extraction…"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => { setInitial({ application_date: new Date().toISOString().split('T')[0], status: 'Applied', priority: 'medium' }); setStep('form'); }}
            className="btn-secondary flex-1"
          >
            Skip — Fill Manually
          </button>
          <button
            type="button"
            onClick={handleExtract}
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Extracting…</>
            ) : (
              <><Wand2 className="w-4 h-4" /> Extract & Continue</>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
