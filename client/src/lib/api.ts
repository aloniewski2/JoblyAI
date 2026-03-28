import axios from 'axios';
import type { Application, Resume, DashboardStats, StatusHistory, EmailActivity } from '../types';

const api = axios.create({ baseURL: '/api' });

// Applications
export const getApplications = (params?: Record<string, string>) =>
  api.get<{ applications: Application[]; total: number }>('/applications', { params }).then(r => r.data);

export const getApplication = (id: number) =>
  api.get<Application>(`/applications/${id}`).then(r => r.data);

export const createApplication = (data: Partial<Application>) =>
  api.post<Application>('/applications', data).then(r => r.data);

export const updateApplication = (id: number, data: Partial<Application>) =>
  api.put<Application>(`/applications/${id}`, data).then(r => r.data);

export const deleteApplication = (id: number) =>
  api.delete(`/applications/${id}`).then(r => r.data);

export const clearApplications = () =>
  api.delete('/applications').then(r => r.data);

export const updateStatus = (id: number, status: string, notes = '') =>
  api.post<{ success: boolean; status: string; interview_prep: string | null }>(`/applications/${id}/status`, { status, notes }).then(r => r.data);

export const getStatusHistory = (id: number) =>
  api.get<StatusHistory[]>(`/applications/${id}/status-history`).then(r => r.data);

export const getApplicationEmails = (id: number) =>
  api.get<EmailActivity[]>(`/applications/${id}/emails`).then(r => r.data);

export const addFollowUp = (id: number, due_date: string, notes = '') =>
  api.post(`/applications/${id}/followup`, { due_date, notes }).then(r => r.data);

// Dashboard
export const getDashboard = () =>
  api.get<DashboardStats>('/dashboard').then(r => r.data);

export const getToday = () =>
  api.get('/dashboard/today').then(r => r.data);

// Quick Add
export const extractJobFromUrl = (url: string) =>
  api.post<{ extracted: Partial<Application>; warning?: string }>('/quick-add/extract', { url }).then(r => r.data);

export const extractJobFromText = (text: string) =>
  api.post<{ extracted: Partial<Application>; warning?: string }>('/ai/extract', { text }).then(r => r.data);

// Resumes
export const getResumes = () =>
  api.get<Resume[]>('/resumes').then(r => r.data);

export const uploadResume = (formData: FormData) =>
  api.post<Resume>('/resumes', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data);

export const updateResume = (id: number, data: { name?: string; tags?: string[]; is_master?: number }) =>
  api.put<Resume>(`/resumes/${id}`, data).then(r => r.data);

export const deleteResume = (id: number) =>
  api.delete(`/resumes/${id}`).then(r => r.data);

export const extractResumeText = (id: number) =>
  api.post<{ success: boolean; hasText: boolean; length: number }>(`/resumes/${id}/extract-text`).then(r => r.data);

export const downloadResumeUrl = (id: number) => `/api/resumes/${id}/download`;

// AI
export const aiMatch = (data: {
  resume_text?: string;
  resume_id?: number;
  job_description: string;
  job_title?: string;
  company?: string;
}) => api.post('/ai/match', data).then(r => r.data);

export const aiChat = (message: string, context?: object) =>
  api.post<{ response: string }>('/ai/chat', { message, context }).then(r => r.data);

export const aiSummarize = (job_description: string, job_title?: string, company?: string) =>
  api.post<{ summary: string }>('/ai/summarize', { job_description, job_title, company }).then(r => r.data);

export const aiInterviewPrep = (job_title: string, company: string, job_description?: string) =>
  api.post<{ prep: string }>('/ai/interview-prep', { job_title, company, job_description }).then(r => r.data);

// Gmail
export const getGmailStatus = () =>
  api.get<{ connected: boolean; hasCredentials: boolean; lastSync: string | null }>('/gmail/status').then(r => r.data);

export const getGmailAuthUrl = () =>
  api.get<{ authUrl: string }>('/gmail/auth-url').then(r => r.data);

export const syncGmail = () =>
  api.post<{ processed: number; emails: object[] }>('/gmail/sync').then(r => r.data);

export const disconnectGmail = () =>
  api.post('/gmail/disconnect').then(r => r.data);

export const getEmails = (applicationId?: number) =>
  api.get<EmailActivity[]>('/gmail/emails', { params: applicationId ? { applicationId } : {} }).then(r => r.data);

// Settings
export const getSettings = () =>
  api.get<Record<string, string>>('/settings').then(r => r.data);

export const updateSettings = (settings: Record<string, string>) =>
  api.put('/settings', settings).then(r => r.data);

// AI Workflows
export const getDailyBrief = () =>
  api.get<{ brief: string; meta: { followUpsDue: number; interviews: number; staleApps: number; streak: number; totalActive: number } }>('/ai/daily-brief').then(r => r.data);

export const getFollowupSuggestions = (app_ids: number[]) =>
  api.post<{ suggestions: Array<{ app_id: number; subject: string; body: string; company: string; job_title: string; recruiter_email?: string }> }>('/ai/followup-suggestions', { app_ids }).then(r => r.data);

export const aiIntake = (text: string) =>
  api.post<{
    extracted: { company?: string; job_title?: string; location?: string; salary_range?: string; job_description?: string };
    match: { fit_score: number; recommendation: string; recommendation_reason: string; summary: string; strengths: string[]; gaps: string[]; apply_tip: string } | null;
    hasResume: boolean;
  }>('/ai/intake', { text }).then(r => r.data);

// Contacts
export type Contact = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  position: string;
  connected_on: string;
  notes: string;
  application_id: number | null;
  linked_company?: string;
  linked_job_title?: string;
  linked_status?: string;
  at_applied_company?: boolean;
  matched_app_id?: number | null;
  created_at: string;
};

export const getContacts = (params?: Record<string, string>) =>
  api.get<{ contacts: Contact[]; total: number }>('/contacts', { params }).then(r => r.data);

export const getContactStats = () =>
  api.get<{ total: number; linked: number; companies: number; atAppliedCompanies: number }>('/contacts/stats').then(r => r.data);

export const getContactCompanies = () =>
  api.get<string[]>('/contacts/companies').then(r => r.data);

export const updateContact = (id: number, data: { notes?: string; application_id?: number | null }) =>
  api.put<Contact>(`/contacts/${id}`, data).then(r => r.data);

export const deleteContact = (id: number) =>
  api.delete(`/contacts/${id}`).then(r => r.data);

export const clearContacts = () =>
  api.delete('/contacts').then(r => r.data);

export const aiCoverLetter = (app_id: number, tone?: 'professional' | 'enthusiastic' | 'concise') =>
  api.post<{ cover_letter: string }>('/ai/cover-letter', { app_id, tone }).then(r => r.data);

// Interview questions
export type InterviewQuestion = {
  id: number;
  application_id: number;
  round: string;
  question: string;
  answer: string;
  created_at: string;
};

export const getApplicationConnections = (appId: number) =>
  api.get<Contact[]>(`/applications/${appId}/connections`).then(r => r.data);

export const aiWarmIntro = (app_id: number, contact_id: number) =>
  api.post<{ message: string; contact_name: string; contact_email: string }>('/ai/warm-intro', { app_id, contact_id }).then(r => r.data);

export const getInterviewQuestions = (appId: number) =>
  api.get<InterviewQuestion[]>(`/applications/${appId}/questions`).then(r => r.data);

export const addInterviewQuestion = (appId: number, data: { round?: string; question: string; answer?: string }) =>
  api.post<InterviewQuestion>(`/applications/${appId}/questions`, data).then(r => r.data);

export const updateInterviewQuestion = (appId: number, qid: number, answer: string) =>
  api.patch<InterviewQuestion>(`/applications/${appId}/questions/${qid}`, { answer }).then(r => r.data);

export const deleteInterviewQuestion = (appId: number, qid: number) =>
  api.delete(`/applications/${appId}/questions/${qid}`).then(r => r.data);

// Analytics
export const getAnalytics = () =>
  api.get<{
    funnel: { total: number; applied: number; screened: number; interviewed: number; offered: number };
    bySource: Array<{ source: string; total: number; reached_interview: number; offers: number; rejected: number }>;
    weeklyVolume: Array<{ week: string; count: number }>;
    statusBreakdown: Array<{ status: string; count: number }>;
    avgDaysToInterview: number | null;
  }>('/dashboard/analytics').then(r => r.data);

export const aiTailorResume = (app_id: number, resume_text: string, resume_id?: number) =>
  api.post<{ tailored_resume: string }>('/ai/tailor-resume', { app_id, resume_text, resume_id }).then(r => r.data);

export const aiCompareOffers = (app_ids: number[]) =>
  api.post<{
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
  }>('/ai/compare-offers', { app_ids }).then(r => r.data);
