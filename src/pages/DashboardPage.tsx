import React, { useMemo } from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  FolderArchive,
  HelpCircle,
  Layers,
  Plus,
  Scale,
  Settings,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { getTodayNepaliDate } from '../domain/nepaliCalendar';
import type {
  ActivitySelection,
  ActivityType,
  ClassRecord,
  ClassSession,
  DailyAttendanceRecord,
  Student,
} from '../domain/types';

interface DashboardPageProps {
  classes: ClassRecord[];
  activeClassId: string;
  students: Student[];
  sessions: ClassSession[];
  selections: ActivitySelection[];
  dailyAttendanceRecords: DailyAttendanceRecord[];
  lastBackupAt?: number;
  onSelectClass: (classId: string) => void;
  onQuickLaunchActivity: (classId: string, type: ActivityType) => void;
  onStartSession: (classId: string) => void;
  onResumeSession: (classId: string) => void;
  onOpenClassOverview: (classId: string) => void;
  onOpenAttendance: (classId: string, tab?: 'daily_register' | 'archive') => void;
  onOpenRoster: (classId: string, tab?: 'students' | 'studio' | 'cards') => void;
  onAddStudent: () => void;
  onImportStudents: () => void;
  onManageClasses: () => void;
  onGoBackup: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  classes,
  activeClassId,
  students,
  sessions,
  dailyAttendanceRecords,
  onSelectClass,
  onQuickLaunchActivity,
  onResumeSession,
  onOpenAttendance,
  onOpenRoster,
  onAddStudent,
  onImportStudents,
  onManageClasses,
  onGoBackup,
}) => {
  const activeClasses = useMemo(() => classes.filter((c) => !c.archivedAt), [classes]);
  const todayBs = useMemo(() => getTodayNepaliDate(), []);

  const selectedClass =
    activeClasses.find((c) => c.id === activeClassId) ?? activeClasses[0] ?? null;

  const selectedClassStudents = useMemo(
    () =>
      selectedClass
        ? students.filter((s) => s.classId === selectedClass.id && s.activeStatus === 'active')
        : [],
    [students, selectedClass]
  );

  const selectedClassSession = useMemo(
    () =>
      selectedClass
        ? sessions.find((s) => s.classId === selectedClass.id && s.status === 'active') ?? null
        : null,
    [sessions, selectedClass]
  );

  const selectedClassTodayAttendance = useMemo(
    () =>
      selectedClass
        ? dailyAttendanceRecords.find(
            (r) => r.classId === selectedClass.id && r.bsDate === todayBs.bsDateString
          ) ?? null
        : null,
    [dailyAttendanceRecords, selectedClass, todayBs.bsDateString]
  );

  const presentCount = selectedClassTodayAttendance
    ? selectedClassTodayAttendance.presentCount
    : selectedClassSession
      ? Math.max(0, selectedClassStudents.length - selectedClassSession.absentStudentIds.length)
      : selectedClassStudents.length;

  const absentCount = selectedClassTodayAttendance
    ? selectedClassTodayAttendance.absentCount
    : selectedClassSession
      ? selectedClassSession.absentStudentIds.length
      : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Compact Brand & Date Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-3">
          <img
            src="/pwa-512x512.png"
            alt="Classroom Helper"
            data-testid="home-3d-app-icon"
            className="w-11 h-11 rounded-xl object-cover shrink-0 border border-[var(--border-hairline)] shadow-2xs"
          />
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-[var(--ink)]">
              Classroom Helper
            </h1>
            <p className="text-xs text-[var(--ink-muted)]">
              {todayBs.monthNameEn} {todayBs.bsDay}, {todayBs.bsYear} BS ({todayBs.monthNameNp}) ·{' '}
              {todayBs.weekdayNameEn}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddStudent}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-[var(--accent)]" />
            Add Student
          </button>
          <button
            type="button"
            onClick={onImportStudents}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
            Import CSV
          </button>
        </div>
      </header>

      {activeClasses.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] text-center space-y-3">
          <p className="text-sm font-medium text-[var(--ink)]">No classes created yet.</p>
          <button
            type="button"
            onClick={onManageClasses}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-xs font-semibold text-white cursor-pointer"
          >
            Create First Class
          </button>
        </div>
      ) : (
        <>
          {/* Synced Class Selector Tabs */}
          <section aria-label="Select Class" className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {activeClasses.map((cls) => {
                const isSelected = selectedClass?.id === cls.id;
                const count = students.filter(
                  (s) => s.classId === cls.id && s.activeStatus === 'active'
                ).length;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => onSelectClass(cls.id)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--ink)] text-white shadow-2xs'
                        : 'bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--ink)] hover:bg-[var(--surface-subtle)]'
                    }`}
                  >
                    <span>{cls.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono-tabular ${
                        isSelected
                          ? 'bg-white/15 text-white'
                          : 'bg-[var(--surface-subtle)] text-[var(--ink-muted)]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={onManageClasses}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-dashed border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Classes
              </button>
            </div>

            {selectedClass && (
              <div className="text-xs text-[var(--ink-muted)] font-medium">
                {selectedClassStudents.length} students ·{' '}
                <span className="text-[var(--sage)] font-semibold">{presentCount} present</span>
                {absentCount > 0 ? (
                  <>
                    {' · '}
                    <span className="text-[var(--crimson)] font-semibold">{absentCount} absent</span>
                  </>
                ) : null}
              </div>
            )}
          </section>

          {/* 4 Core One-Tap Actions for the Selected Class */}
          {selectedClass && (
            <section aria-label={`${selectedClass.name} actions`} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Mystery Pick (Primary 1-Tap Launch) */}
                <button
                  type="button"
                  data-testid="dashboard-quick-pick-btn"
                  onClick={() => {
                    if (selectedClassSession) {
                      onResumeSession(selectedClass.id);
                    } else {
                      onQuickLaunchActivity(selectedClass.id, 'single_pick');
                    }
                  }}
                  className="p-4 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-left flex flex-col justify-between gap-4 cursor-pointer transition-colors shadow-2xs"
                >
                  <div className="flex items-center justify-between w-full">
                    <Layers className="w-5 h-5" />
                    <span className="text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-md">
                      {selectedClass.name}
                    </span>
                  </div>
                  <div>
                    <div className="text-base font-bold leading-snug">
                      {selectedClassSession ? 'Resume Pick' : 'Pick Student Cards'}
                    </div>
                    <div className="text-xs text-white/80 mt-0.5">
                      Shuffle &amp; flip 3D cards
                    </div>
                  </div>
                </button>

                {/* 2. Daily Attendance (BS) */}
                <button
                  type="button"
                  data-testid="dashboard-open-attendance-btn"
                  onClick={() => onOpenAttendance(selectedClass.id, 'daily_register')}
                  className="p-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-left flex flex-col justify-between gap-4 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between w-full">
                    <Calendar className="w-5 h-5 text-[var(--accent)]" />
                    {selectedClassTodayAttendance ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--sage)]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Saved
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-[var(--ink-muted)]">
                        Today BS
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-base font-bold text-[var(--ink)] leading-snug">
                      Daily Attendance
                    </div>
                    <div className="text-xs text-[var(--ink-muted)] mt-0.5">
                      {selectedClassTodayAttendance
                        ? `${presentCount} present · ${absentCount} absent`
                        : `Mark ${todayBs.monthNameEn} ${todayBs.bsDay}`}
                    </div>
                  </div>
                </button>

                {/* 3. Team Builder */}
                <button
                  type="button"
                  onClick={() => onQuickLaunchActivity(selectedClass.id, 'groups')}
                  className="p-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-left flex flex-col justify-between gap-4 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between w-full">
                    <Users className="w-5 h-5 text-[var(--accent)]" />
                    <span className="text-[11px] font-medium text-[var(--ink-muted)]">
                      Groups
                    </span>
                  </div>
                  <div>
                    <div className="text-base font-bold text-[var(--ink)] leading-snug">
                      Team Builder
                    </div>
                    <div className="text-xs text-[var(--ink-muted)] mt-0.5">
                      Split {presentCount} students into teams
                    </div>
                  </div>
                </button>

                {/* 4. Students & 3D Characters */}
                <button
                  type="button"
                  onClick={() => onOpenRoster(selectedClass.id, 'students')}
                  className="p-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-left flex flex-col justify-between gap-4 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between w-full">
                    <UserPlus className="w-5 h-5 text-[var(--accent)]" />
                    <span className="text-[11px] font-mono-tabular text-[var(--ink-muted)]">
                      {selectedClassStudents.length}
                    </span>
                  </div>
                  <div>
                    <div className="text-base font-bold text-[var(--ink)] leading-snug">
                      Students &amp; 3D Studio
                    </div>
                    <div className="text-xs text-[var(--ink-muted)] mt-0.5">
                      Edit list, CSV &amp; 3D faces
                    </div>
                  </div>
                </button>
              </div>

              {/* Secondary Quick Modes Strip */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onQuickLaunchActivity(selectedClass.id, 'two_toss')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                  Two-Student Toss
                </button>
                <button
                  type="button"
                  onClick={() => onQuickLaunchActivity(selectedClass.id, 'student_question')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                  Question Pick
                </button>
                <button
                  type="button"
                  onClick={() => onQuickLaunchActivity(selectedClass.id, 'lucky_picker')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                  Duty Picker
                </button>
                <button
                  type="button"
                  data-testid="dashboard-open-attendance-archive-btn"
                  onClick={() => onOpenAttendance(selectedClass.id, 'archive')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
                  Monthly Archive
                </button>
              </div>
            </section>
          )}

          {/* Clean, Simple All-Classes List */}
          <section aria-labelledby="classes-heading" className="pt-2">
            <div className="flex items-center justify-between mb-2.5">
              <h2
                id="classes-heading"
                className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]"
              >
                All Classes ({activeClasses.length})
              </h2>
              <button
                type="button"
                onClick={onManageClasses}
                className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
              >
                Manage Classes
              </button>
            </div>

            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)]">
              {activeClasses.map((cls) => {
                const count = students.filter(
                  (s) => s.classId === cls.id && s.activeStatus === 'active'
                ).length;
                const todayRec = dailyAttendanceRecords.find(
                  (rec) => rec.classId === cls.id && rec.bsDate === todayBs.bsDateString
                );
                const isSelected = selectedClass?.id === cls.id;

                return (
                  <div
                    key={cls.id}
                    onClick={() => onSelectClass(cls.id)}
                    className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[var(--accent-soft)]/50' : 'hover:bg-[var(--surface-subtle)]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isSelected ? 'bg-[var(--accent)]' : 'bg-[var(--border-hairline)]'
                        }`}
                      />
                      <span className="font-semibold text-sm text-[var(--ink)]">{cls.name}</span>
                      <span className="text-xs text-[var(--ink-muted)] font-mono-tabular">
                        {count} students
                      </span>
                      {todayRec && (
                        <span className="text-xs font-medium text-[var(--sage)]">
                          · {todayRec.presentCount}/{count} present
                        </span>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenAttendance(cls.id, 'daily_register')}
                        className="px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface)] hover:bg-[var(--surface-subtle)] text-xs font-medium text-[var(--ink)] cursor-pointer"
                      >
                        Attendance
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuickLaunchActivity(cls.id, 'single_pick')}
                        className="px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-semibold text-white cursor-pointer"
                      >
                        Pick Cards
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Minimal Settings Link */}
      <footer className="pt-2 flex items-center justify-between text-xs text-[var(--ink-muted)] border-t border-[var(--border-hairline)]">
        <span>Saved locally on this device</span>
        <button
          type="button"
          onClick={onGoBackup}
          className="inline-flex items-center gap-1 font-semibold text-[var(--ink)] hover:text-[var(--accent)] cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings &amp; Backup
        </button>
      </footer>
    </div>
  );
};
