import { type ApplicationStatus, STATUS_COLORS } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  status: ApplicationStatus;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export default function StatusBadge({ status, size = 'md', dot = false }: Props) {
  const colorClass = STATUS_COLORS[status] || 'bg-slate-100 text-slate-700';
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium rounded-full', colorClass, sizeClass)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
      {status}
    </span>
  );
}
