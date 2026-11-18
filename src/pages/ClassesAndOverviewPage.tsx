import React, { useState } from 'react';
import { Archive, Edit3, Play, Plus, RotateCcw, Users } from 'lucide-react';
import { getActivityDisplayLabel } from '../domain/eligibility';
import type { ActivityRecord, ClassRecord, ClassSession, Student } from '../domain/types';

interface ClassesPageProps {
  classes: ClassRecord[];
  students: Student[];
  sessions: ClassSession[];
  onCreateClass: (name: string) => Promise<void>;
  onRenameClass: (classId: string, name: string) => Promise<void>;
  onToggleArchiveClass: (classId: string, archive: boolean) => Promise<void>;
  onOpenClassOverview: (classId: string) => void;
}

export const ClassesPage: React.FC<ClassesPageProps> = ({
  classes,
  students,
  sessions,
  onCreateClass,
  onRenameClass,
  onToggleArchiveClass,
  onOpenClassOverview,
}) => {
  const [newClassName, setNewClassName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleClasses = classes.filter((c) => (showArchived ? !!c.archivedAt : !c.archivedAt));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = newClassName.trim();
    if (!trimmed) {
      setError('Please enter a class name.');
      return;
    }
    if (classes.some((c) => !c.archivedAt && c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" already exists.`);
      return;
    }
    await onCreateClass(trimmed);
    setNewClassName('');
  };

  const handleSaveRename = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    await onRenameClass(id, trimmed);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-[var(--ink)]">Classes</h1>

        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className="px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer self-start"
        >
          {showArchived ? 'Active Classes' : 'Archived'}
        </button>
      </div>

      <form onSubmit={handleAdd} className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label htmlFor="new-class-input" className="sr-only">New class name</label>
          <input
            id="new-class-input"
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="Add new class (e.g. Class 8, Science Club)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Class
        </button>
      </form>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-[var(--crimson-soft)] border border-[var(--crimson)]/35 text-sm text-[var(--crimson)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleClasses.map((cls) => {
          const count = students.filter((s) => s.classId === cls.id && s.activeStatus === 'active').length;
          const hasActiveSession = sessions.some((s) => s.classId === cls.id && s.status === 'active');

          return (
            <div key={cls.id} className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] p-5 flex flex-col justify-between gap-4">
              {editingId === cls.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    aria-label="Edit class name"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveRename(cls.id)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-xs font-semibold text-white cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-display font-bold text-[var(--ink)]">{cls.name}</h2>
                    <div className="text-xs text-[var(--ink-muted)] mt-1 font-mono-tabular">
                      {count} active students {hasActiveSession ? '· Session paused' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(cls.id);
                        setEditingName(cls.name);
                      }}
                      aria-label={`Rename ${cls.name}`}
                      className="p-2 rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleArchiveClass(cls.id, !cls.archivedAt)}
                      aria-label={cls.archivedAt ? `Restore ${cls.name}` : `Archive ${cls.name}`}
                      className="p-2 rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {!cls.archivedAt && (
                <button
                  type="button"
                  onClick={() => onOpenClassOverview(cls.id)}
                  className="w-full py-2 px-4 rounded-xl bg-[var(--surface-subtle)] hover:bg-[var(--accent-soft)] text-sm font-semibold text-[var(--ink)] cursor-pointer"
                >
                  Open Class Overview
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ClassOverviewPageProps {
  classRecord: ClassRecord;
  students: Student[];
  activeSession: ClassSession | null;
  recentActivities: ActivityRecord[];
  onResumeSession: () => void;
  onStartNewSession: () => void;
  onEditAttendance: () => void;
  onOpenAttendanceArchive: () => void;
  onManageStudents: () => void;
  onOpenCardCollection: () => void;
}

export const ClassOverviewPage: React.FC<ClassOverviewPageProps> = ({
  classRecord,
  students,
  activeSession,
  recentActivities,
  onResumeSession,
  onStartNewSession,
  onEditAttendance,
  onOpenAttendanceArchive,
  onManageStudents,
  onOpenCardCollection,
}) => {
  const activeRoster = students.filter(
    (s) => s.classId === classRecord.id && s.activeStatus === 'active'
  );
  const absentCount = activeSession?.absentStudentIds.length ?? 0;
  const presentCount = Math.max(0, activeRoster.length - absentCount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[var(--border-hairline)]">
        <div>
          <div className="text-xs font-medium text-[var(--ink-muted)]">Class Overview</div>
          <h1 className="text-3xl font-display font-bold text-[var(--ink)] mt-1">
            {classRecord.name}
          </h1>
          <div className="mt-1.5 flex items-center gap-2 text-sm text-[var(--ink-muted)] font-mono-tabular">
            <span>{activeRoster.length} active students</span>
            {activeSession && (
              <>
                <span aria-hidden="true">·</span>
                <span>{presentCount} present</span>
                <span aria-hidden="true">·</span>
                <span>{absentCount} absent</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenAttendanceArchive}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            BS Attendance Archive
          </button>
          <button
            type="button"
            onClick={onManageStudents}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            <Users className="w-4 h-4" />
            Roster ({activeRoster.length})
          </button>
          <button
            type="button"
            onClick={onOpenCardCollection}
            className="px-4 py-2 rounded-xl border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            View Cards
          </button>
        </div>
      </div>

      {/* Session Entry Card */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] p-6">
        {activeSession ? (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <h2 className="text-xl font-display font-semibold text-[var(--ink)]">
                Session Paused · Ready to Resume
              </h2>
              <p className="text-sm text-[var(--ink-muted)] mt-1">
                Started {new Date(activeSession.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.
                Resuming keeps your attendance ({presentCount} present, {absentCount} absent) and selections intact.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onResumeSession}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Resume Current Session
              </button>
              <button
                type="button"
                onClick={onEditAttendance}
                className="px-4 py-2.5 rounded-xl border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
              >
                Edit Attendance
              </button>
              <button
                type="button"
                onClick={onStartNewSession}
                className="px-4 py-2.5 rounded-xl border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
              >
                Start New Session
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <h2 className="text-xl font-display font-semibold text-[var(--ink)]">
                Ready for a New Session
              </h2>
              <p className="text-sm text-[var(--ink-muted)] mt-1">
                Starting a new session opens a fast roll-sorted attendance matrix before launching Mystery Pick or any classroom activity.
              </p>
            </div>
            <button
              type="button"
              onClick={onStartNewSession}
              disabled={activeRoster.length === 0}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Play className="w-4 h-4" />
              Start New Session
            </button>
          </div>
        )}
      </div>

      {/* Recent Activities in this Class */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-[var(--shadow-card)] p-5">
        <h2 className="text-lg font-display font-semibold text-[var(--ink)] mb-3">
          Recent Class Activities
        </h2>
        {recentActivities.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">
            No activities completed yet for {classRecord.name}.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border-hairline)]">
            {recentActivities.slice(0, 6).map((act) => (
              <li key={act.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div>
                  <span className="font-semibold text-[var(--ink)]">
                    {getActivityDisplayLabel(act.type)}
                  </span>
                  <span className="text-[var(--ink-muted)]">
                    {' · '}
                    {act.selectionMode.replace('_', ' ')}
                    {' · '}
                    {act.selectedStudentIds.length} selected
                  </span>
                </div>
                <span className="text-xs font-mono-tabular text-[var(--ink-muted)]">
                  {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
