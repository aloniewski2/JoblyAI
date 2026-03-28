import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getApplications, updateStatus } from '../lib/api';
import StatusBadge from '../components/applications/StatusBadge';
import { ALL_STATUSES, STATUS_COLORS, PRIORITY_COLORS, type Application, type ApplicationStatus } from '../types';
import { formatDate, cn } from '../lib/utils';
import { MapPin, Calendar, User, GripVertical } from 'lucide-react';

// Compact columns to show: active pipeline
const KANBAN_STATUSES: ApplicationStatus[] = [
  'Interested', 'Planning to Apply', 'Applied', 'Recruiter Screen',
  'Interview Round 1', 'Interview Round 2', 'Final Round', 'Offer', 'On Hold'
];

function KanbanCard({ app, isDragging = false }: { app: Application; isDragging?: boolean }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: app.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-sm transition-shadow',
        isDragging || isSortableDragging ? 'opacity-50 shadow-lg' : 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600'
      )}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 flex-shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0" onClick={() => navigate(`/applications/${app.id}`)}>
          <div className="flex items-start justify-between gap-1 mb-1">
            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-tight truncate">
              {app.company}
            </div>
            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0', PRIORITY_COLORS[app.priority])}>
              {app.priority === 'high' ? '↑' : app.priority === 'medium' ? '→' : '↓'}
            </span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate mb-2">{app.job_title}</div>
          <div className="flex flex-col gap-1">
            {app.location && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{app.location}</span>
              </div>
            )}
            {app.interview_date && (
              <div className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                <span>Interview {formatDate(app.interview_date, 'MMM d')}</span>
              </div>
            )}
            {app.recruiter_name && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{app.recruiter_name}</span>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-2">{formatDate(app.application_date, 'MMM d')}</div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  status, apps
}: { status: ApplicationStatus; apps: Application[] }) {
  const colorClass = STATUS_COLORS[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex-shrink-0 w-64 flex flex-col">
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg mb-2')}>
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', colorClass)}>
          {status}
        </span>
        <span className="ml-auto text-xs text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
          {apps.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[100px] rounded-xl p-2 space-y-2 transition-colors',
          isOver
            ? 'bg-primary-100 dark:bg-primary-900/20 ring-2 ring-primary-400 ring-inset'
            : 'bg-slate-100 dark:bg-slate-800/50'
        )}
      >
        <SortableContext items={apps.map(a => a.id)} strategy={verticalListSortingStrategy}>
          {apps.map(app => (
            <KanbanCard key={app.id} app={app} />
          ))}
        </SortableContext>
        {apps.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-slate-400 dark:text-slate-500">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

export default function Kanban() {
  const { data } = useQuery({ queryKey: ['applications', {}], queryFn: () => getApplications() });
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);

  const applications = data?.applications || [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const getAppsByStatus = (status: ApplicationStatus) =>
    applications.filter(a => a.status === status);

  const activeApp = activeId ? applications.find(a => a.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Determine target status from over.id
    // over.id could be a card id or a column status
    const targetStatus = KANBAN_STATUSES.find(s => s === over.id) ||
      applications.find(a => a.id === over.id)?.status;

    if (!targetStatus) return;

    const draggedApp = applications.find(a => a.id === active.id);
    if (!draggedApp || draggedApp.status === targetStatus) return;

    try {
      await updateStatus(draggedApp.id, targetStatus);
      qc.invalidateQueries({ queryKey: ['applications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Moved to ${targetStatus}`);
    } catch {
      toast.error('Update failed');
    }
  };

  const terminalApps = applications.filter(a =>
    ['Rejected', 'Withdrawn'].includes(a.status)
  );

  const visibleStatuses = KANBAN_STATUSES;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Kanban Board</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Drag cards to update status</p>
        </div>
        <button
          onClick={() => setShowTerminal(v => !v)}
          className="btn-ghost text-xs"
        >
          {showTerminal ? 'Hide' : 'Show'} Rejected/Withdrawn ({terminalApps.length})
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {visibleStatuses.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              apps={getAppsByStatus(status)}
            />
          ))}
          {showTerminal && (
            <>
              <KanbanColumn status="Rejected" apps={getAppsByStatus('Rejected')} />
              <KanbanColumn status="Withdrawn" apps={getAppsByStatus('Withdrawn')} />
            </>
          )}
        </div>

        <DragOverlay>
          {activeApp && <KanbanCard app={activeApp} isDragging />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
