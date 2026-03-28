import { format, formatDistanceToNow, parseISO, differenceInDays, isToday, isTomorrow, isPast } from 'date-fns';

export function formatDate(date: string | null | undefined, fmt = 'MMM d, yyyy') {
  if (!date) return '—';
  try {
    return format(parseISO(date), fmt);
  } catch {
    try { return format(new Date(date), fmt); } catch { return date; }
  }
}

export function formatRelative(date: string | null | undefined) {
  if (!date) return '—';
  try {
    return formatDistanceToNow(parseISO(date), { addSuffix: true });
  } catch {
    return date;
  }
}

export function daysSince(date: string | null | undefined) {
  if (!date) return null;
  try {
    return differenceInDays(new Date(), parseISO(date));
  } catch { return null; }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateLabel(date: string | null | undefined) {
  if (!date) return null;
  try {
    const d = parseISO(date);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    if (isPast(d)) return `${differenceInDays(new Date(), d)}d overdue`;
    return format(d, 'MMM d');
  } catch { return date; }
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

export function getNoResponseDays(applicationDate: string) {
  const days = daysSince(applicationDate);
  if (days === null) return null;
  if (days >= 21) return { level: 'critical', days, label: `${days}d — Very overdue` };
  if (days >= 14) return { level: 'warning', days, label: `${days}d — Follow up now` };
  if (days >= 7) return { level: 'mild', days, label: `${days}d — Consider following up` };
  return null;
}

export const SOURCES = [
  'LinkedIn', 'Company Site', 'Recruiter', 'Referral',
  'Indeed', 'Glassdoor', 'AngelList', 'Handshake', 'Other'
];
