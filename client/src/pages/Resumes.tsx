import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Upload, Download, Trash2, Star,
  FileText, Plus, X, Check, Edit2, Loader2, Eye
} from 'lucide-react';
import { getResumes, uploadResume, deleteResume, updateResume, downloadResumeUrl, extractResumeText } from '../lib/api';
import { formatDate, formatFileSize, cn } from '../lib/utils';
import type { Resume } from '../types';
import Modal from '../components/ui/Modal';

const RESUME_TAGS = [
  'consulting', 'strategy', 'operations', 'risk', 'fintech',
  'product', 'banking', 'tech', 'healthcare', 'bcg', 'mckinsey', 'bain', 'other'
];

function TagPill({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-primary-900"><X className="w-3 h-3" /></button>
      )}
    </span>
  );
}

function ResumeCard({ resume, onDelete, onEdit, onView }: {
  resume: Resume; onDelete: (id: number) => void; onEdit: (r: Resume) => void; onView: (r: Resume) => void;
}) {
  return (
    <div className="card p-5 flex gap-4 group hover:shadow-md transition-shadow">
      <div className="w-10 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={() => onView(resume)}>
        <FileText className="w-5 h-5 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="cursor-pointer" onClick={() => onView(resume)}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{resume.name}</span>
              {resume.is_master === 1 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                  <Star className="w-3 h-3" /> Master
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {resume.original_name} · {formatFileSize(resume.file_size)} · {formatDate(resume.created_at)}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onView(resume)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onEdit(resume)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <a href={downloadResumeUrl(resume.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
              <Download className="w-3.5 h-3.5" />
            </a>
            <button onClick={() => onDelete(resume.id)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {resume.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {resume.tags.map(t => <TagPill key={t} tag={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewModal({ resume, onClose }: { resume: Resume; onClose: () => void }) {
  const isPdf = resume.original_name.toLowerCase().endsWith('.pdf');
  return (
    <Modal title={resume.name} onClose={onClose} size="xl">
      <div className="px-1 pb-1">
        {isPdf ? (
          <iframe
            src={`/api/resumes/${resume.id}/view`}
            className="w-full rounded-lg"
            style={{ height: '75vh' }}
            title={resume.name}
          />
        ) : (
          <div className="p-12 text-center space-y-4">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Preview not available for Word files.
            </div>
            <a href={downloadResumeUrl(resume.id)} className="btn-primary inline-flex">
              <Download className="w-4 h-4" /> Download to view
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) { toast.error('Select a file first'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name || file.name);
      fd.append('tags', JSON.stringify(tags));
      fd.append('is_master', isMaster ? '1' : '0');
      await uploadResume(fd);
      toast.success('Resume uploaded');
      onUploaded();
      onClose();
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal title="Upload Resume" onClose={onClose} size="md">
      <div className="px-6 py-5 space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            drag ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/10' :
              file ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' :
                'border-slate-300 dark:border-slate-600 hover:border-primary-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          )}
        >
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {file ? (
            <div>
              <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{file.name}</div>
              <div className="text-xs text-slate-400">{formatFileSize(file.size)}</div>
            </div>
          ) : (
            <div>
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Drop PDF, DOC, or DOCX here</div>
              <div className="text-xs text-slate-400 mt-1">or click to browse</div>
            </div>
          )}
        </div>

        <div>
          <label className="label">Resume Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Consulting Resume 2025" />
        </div>

        <div>
          <label className="label">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(t => <TagPill key={t} tag={t} onRemove={() => setTags(tags.filter(x => x !== t))} />)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {RESUME_TAGS.filter(t => !tags.includes(t)).map(t => (
              <button key={t} onClick={() => setTags([...tags, t])}
                className="text-xs px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary-400 hover:text-primary-600 transition-colors">
                + {t}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isMaster} onChange={e => setIsMaster(e.target.checked)} className="w-4 h-4 rounded text-primary-600" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Set as Master Resume</span>
        </label>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleUpload} disabled={!file || uploading} className="btn-primary">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Upload className="w-4 h-4" /> Upload</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditModal({ resume, onClose, onSaved }: { resume: Resume; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(resume.name);
  const [tags, setTags] = useState<string[]>(resume.tags);
  const [isMaster, setIsMaster] = useState(resume.is_master === 1);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateResume(resume.id, { name, tags, is_master: isMaster ? 1 : 0 });
      toast.success('Updated');
      onSaved();
      onClose();
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit Resume" onClose={onClose} size="sm">
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(t => <TagPill key={t} tag={t} onRemove={() => setTags(tags.filter(x => x !== t))} />)}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {RESUME_TAGS.filter(t => !tags.includes(t)).map(t => (
              <button key={t} onClick={() => setTags([...tags, t])}
                className="text-xs px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 hover:border-primary-400 hover:text-primary-600 transition-colors">
                + {t}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isMaster} onChange={e => setIsMaster(e.target.checked)} className="w-4 h-4 rounded text-primary-600" />
          <span className="text-sm text-slate-700 dark:text-slate-300">Master Resume</span>
        </label>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Resumes() {
  const [showUpload, setShowUpload] = useState(false);
  const [editResume, setEditResume] = useState<Resume | null>(null);
  const [viewResume, setViewResume] = useState<Resume | null>(null);
  const qc = useQueryClient();

  const { data: resumes = [], isLoading } = useQuery({ queryKey: ['resumes'], queryFn: getResumes });

  // Auto-extract text for any resume that doesn't have it yet
  useEffect(() => {
    const missing = resumes.filter(r => !r.hasText);
    if (!missing.length) return;
    Promise.all(missing.map(r => extractResumeText(r.id))).then(results => {
      const extracted = results.filter(r => r.hasText).length;
      if (extracted > 0) {
        qc.invalidateQueries({ queryKey: ['resumes'] });
      }
    }).catch(() => {});
  }, [resumes.length]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this resume?')) return;
    try {
      await deleteResume(id);
      qc.invalidateQueries({ queryKey: ['resumes'] });
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const masterResume = resumes.find(r => r.is_master === 1);
  const otherResumes = resumes.filter(r => r.is_master !== 1);

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Resumes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{resumes.length} version{resumes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Upload Resume
        </button>
      </div>

      {isLoading && <div className="text-sm text-slate-400">Loading…</div>}

      {!isLoading && resumes.length === 0 && (
        <div className="card p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">No resumes yet</div>
          <div className="text-xs text-slate-400 mt-1 mb-4">Upload your master resume to get started</div>
          <button onClick={() => setShowUpload(true)} className="btn-primary mx-auto">
            <Upload className="w-4 h-4" /> Upload Resume
          </button>
        </div>
      )}

      {masterResume && (
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Master Resume</div>
          <ResumeCard resume={masterResume} onDelete={handleDelete} onEdit={setEditResume} onView={setViewResume} />
        </div>
      )}

      {otherResumes.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Tailored Versions ({otherResumes.length})
          </div>
          <div className="space-y-3">
            {otherResumes.map(r => (
              <ResumeCard key={r.id} resume={r} onDelete={handleDelete} onEdit={setEditResume} onView={setViewResume} />
            ))}
          </div>
        </div>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => qc.invalidateQueries({ queryKey: ['resumes'] })}
        />
      )}

      {editResume && (
        <EditModal
          resume={editResume}
          onClose={() => setEditResume(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['resumes'] })}
        />
      )}

      {viewResume && (
        <PreviewModal resume={viewResume} onClose={() => setViewResume(null)} />
      )}
    </div>
  );
}
