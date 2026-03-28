import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import axios from 'axios';
import { Upload, Loader2, CheckCircle, AlertTriangle, Linkedin, ArrowRight, X } from 'lucide-react';
import Modal from './Modal';
import StatusBadge from '../applications/StatusBadge';
import { cn } from '../../lib/utils';
import type { ApplicationStatus } from '../../types';

type PreviewApp = {
  company: string;
  job_title: string;
  application_date: string;
  status: string;
  source: string;
  recruiter_name: string;
  recruiter_email: string;
  notes: string;
  application_link: string;
  priority: string;
};

type Step = 'upload' | 'preview' | 'done';

export default function LinkedInImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apps, setApps] = useState<PreviewApp[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importedCount, setImportedCount] = useState(0);
  const [fileName, setFileName] = useState('');

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setLoading(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await axios.post('/api/import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (!data.applications?.length) {
        setError('No job applications found in the file. Make sure you\'re uploading your LinkedIn data archive or the "Job Applications" CSV.');
        setLoading(false);
        return;
      }
      setApps(data.applications);
      setSelected(new Set(data.applications.map((_: PreviewApp, i: number) => i)));
      setStep('preview');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error || err.message : 'Upload failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const toggleAll = () => {
    if (selected.size === apps.length) setSelected(new Set());
    else setSelected(new Set(apps.map((_, i) => i)));
  };

  const toggleOne = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  };

  const confirmImport = async () => {
    const toImport = apps.filter((_, i) => selected.has(i));
    if (!toImport.length) return;
    setLoading(true);
    try {
      const { data } = await axios.post('/api/import/confirm', { applications: toImport });
      setImportedCount(data.imported);
      setStep('done');
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['today'] });
    } catch {
      toast.error('Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Import LinkedIn Data" onClose={onClose} size="2xl">
      <div className="px-6 py-5">

        {step === 'upload' && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
              <Linkedin className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <div className="font-medium">How to get your LinkedIn data</div>
                <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-0.5 list-decimal ml-3">
                  <li>Go to LinkedIn Settings → Data Privacy</li>
                  <li>Click "Get a copy of your data"</li>
                  <li>Select "Job applications" (or request all data)</li>
                  <li>Download the zip when LinkedIn emails it to you</li>
                </ol>
              </div>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Drop your LinkedIn archive here</div>
              <div className="text-xs text-slate-400 mt-1">or click to browse — accepts .zip or .csv</div>
              <input
                ref={fileRef}
                type="file"
                accept=".zip,.csv"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Parsing your data…
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Found {apps.length} job application{apps.length !== 1 ? 's' : ''} in <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{fileName}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Deselect any you don't want to import</div>
              </div>
              <button onClick={toggleAll} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                {selected.size === apps.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="w-8 px-3 py-2.5"></th>
                    <th className="text-left text-xs font-medium text-slate-500 px-3 py-2.5">Company</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-3 py-2.5">Role</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-3 py-2.5">Status</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-3 py-2.5">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app, i) => (
                    <tr
                      key={i}
                      onClick={() => toggleOne(i)}
                      className={cn(
                        'border-b border-slate-50 dark:border-slate-800/50 last:border-0 cursor-pointer transition-colors',
                        selected.has(i) ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30 opacity-50'
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <div className={cn(
                          'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                          selected.has(i)
                            ? 'bg-primary-600 border-primary-600'
                            : 'border-slate-300 dark:border-slate-600'
                        )}>
                          {selected.has(i) && <X className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-200 max-w-[150px] truncate">{app.company || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 max-w-[180px] truncate">{app.job_title || '—'}</td>
                      <td className="px-3 py-2.5">
                        {app.status ? <StatusBadge status={app.status as ApplicationStatus} size="sm" /> : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 whitespace-nowrap">{app.application_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setStep('upload')} className="btn-secondary">
                Back
              </button>
              <button
                onClick={confirmImport}
                disabled={loading || selected.size === 0}
                className="btn-primary"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                  : <><ArrowRight className="w-4 h-4" /> Import {selected.size} application{selected.size !== 1 ? 's' : ''}</>
                }
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
            <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Imported {importedCount} application{importedCount !== 1 ? 's' : ''}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Your LinkedIn history is now in your tracker.
            </div>
            <button onClick={onClose} className="btn-primary mx-auto mt-2">
              View Applications
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
