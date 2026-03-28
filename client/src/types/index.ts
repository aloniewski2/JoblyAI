export type ApplicationStatus =
  | 'Interested'
  | 'Planning to Apply'
  | 'Applied'
  | 'Recruiter Screen'
  | 'Interview Round 1'
  | 'Interview Round 2'
  | 'Final Round'
  | 'Offer'
  | 'Rejected'
  | 'Withdrawn'
  | 'On Hold';

export type Priority = 'low' | 'medium' | 'high';

export type ApplicationSource =
  | 'LinkedIn'
  | 'Company Site'
  | 'Recruiter'
  | 'Referral'
  | 'Indeed'
  | 'Glassdoor'
  | 'AngelList'
  | 'Other';

export interface Application {
  id: number;
  company: string;
  job_title: string;
  application_link: string;
  job_description: string;
  location: string;
  salary_range: string;
  application_date: string;
  status: ApplicationStatus;
  source: string;
  resume_version_id: number | null;
  resume_name?: string;
  cover_letter: string;
  recruiter_name: string;
  recruiter_email: string;
  follow_up_date: string | null;
  interview_date: string | null;
  notes: string;
  priority: Priority;
  compensation_notes: string;
  referral_used: boolean;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: number;
  name: string;
  filename: string;
  original_name: string;
  tags: string[];
  file_size: number;
  is_master: number;
  resume_text?: string;
  hasText?: boolean;
  created_at: string;
}

export interface StatusHistory {
  id: number;
  application_id: number;
  status: ApplicationStatus;
  notes: string;
  created_at: string;
}

export interface EmailActivity {
  id: number;
  application_id: number | null;
  gmail_message_id: string;
  subject: string;
  sender: string;
  sender_email: string;
  body_preview: string;
  classification: EmailClassification;
  received_at: string;
  created_at: string;
  company?: string;
  job_title?: string;
}

export type EmailClassification =
  | 'confirmation'
  | 'recruiter_outreach'
  | 'interview_request'
  | 'assessment'
  | 'rejection'
  | 'offer'
  | 'follow_up'
  | 'other'
  | 'unknown';

export interface FollowUp {
  id: number;
  application_id: number;
  due_date: string;
  completed: number;
  notes: string;
  created_at: string;
  company?: string;
  job_title?: string;
  status?: ApplicationStatus;
}

export interface DashboardStats {
  stats: {
    total: number;
    thisWeek: number;
    offers: number;
    rejections: number;
    interviews: number;
    followUpsDue: number;
    streak: number;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  byLocation: Array<{ location: string; count: number }>;
  recentActivity: Array<StatusHistory & { company: string; job_title: string }>;
  noResponseAlert: Array<{ id: number; company: string; job_title: string; application_date: string; days_since: number }>;
  upcomingInterviews: Array<{ id: number; company: string; job_title: string; interview_date: string; status: string }>;
}

export const ALL_STATUSES: ApplicationStatus[] = [
  'Interested', 'Planning to Apply', 'Applied', 'Recruiter Screen',
  'Interview Round 1', 'Interview Round 2', 'Final Round',
  'Offer', 'Rejected', 'Withdrawn', 'On Hold'
];

export const ACTIVE_STATUSES: ApplicationStatus[] = [
  'Interested', 'Planning to Apply', 'Applied', 'Recruiter Screen',
  'Interview Round 1', 'Interview Round 2', 'Final Round', 'On Hold'
];

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  'Interested': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'Planning to Apply': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Applied': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  'Recruiter Screen': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'Interview Round 1': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'Interview Round 2': 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  'Final Round': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'Offer': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Rejected': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'Withdrawn': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  'On Hold': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
};

export const STATUS_DOT_COLORS: Record<ApplicationStatus, string> = {
  'Interested': 'bg-slate-400',
  'Planning to Apply': 'bg-blue-500',
  'Applied': 'bg-indigo-500',
  'Recruiter Screen': 'bg-violet-500',
  'Interview Round 1': 'bg-purple-500',
  'Interview Round 2': 'bg-fuchsia-500',
  'Final Round': 'bg-pink-500',
  'Offer': 'bg-emerald-500',
  'Rejected': 'bg-red-500',
  'Withdrawn': 'bg-gray-400',
  'On Hold': 'bg-amber-500'
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
};

export const EMAIL_CLASSIFICATION_LABELS: Record<EmailClassification, string> = {
  confirmation: 'Confirmation',
  recruiter_outreach: 'Recruiter Outreach',
  interview_request: 'Interview Request',
  assessment: 'Assessment',
  rejection: 'Rejection',
  offer: 'Offer',
  follow_up: 'Follow-up',
  other: 'Other',
  unknown: 'Unknown'
};

export const EMAIL_CLASSIFICATION_COLORS: Record<EmailClassification, string> = {
  confirmation: 'bg-blue-100 text-blue-700',
  recruiter_outreach: 'bg-violet-100 text-violet-700',
  interview_request: 'bg-purple-100 text-purple-700',
  assessment: 'bg-orange-100 text-orange-700',
  rejection: 'bg-red-100 text-red-700',
  offer: 'bg-emerald-100 text-emerald-700',
  follow_up: 'bg-amber-100 text-amber-700',
  other: 'bg-slate-100 text-slate-600',
  unknown: 'bg-slate-100 text-slate-600'
};
