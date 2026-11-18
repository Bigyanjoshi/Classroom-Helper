import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Layers,
  Scale,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { computeDutyTitleCounts } from '../domain/eligibility';
import type {
  ActivitySelection,
  ActivityType,
  ClassRecord,
  ClassSession,
  FairnessScope,
  QuestionItem,
  RepeatPolicy,
  RewardChallengeItem,
  SelectionMode,
  Student,
} from '../domain/types';

interface ActivityCenterPageProps {
  classRecord: ClassRecord;
  session: ClassSession;
  students: Student[];
  selections: ActivitySelection[];
  questions: QuestionItem[];
  rewards: RewardChallengeItem[];
  defaultSelectionMode: SelectionMode;
  defaultRepeatPolicy: RepeatPolicy;
  fairnessScope: FairnessScope;
  onLaunchActivity: (config: {
    type: ActivityType;
    selectionMode: SelectionMode;
    repeatPolicy: RepeatPolicy;
    questionSubject?: string;
    dutyTitle?: string;
  }) => Promise<void>;
  onEditAttendance: () => void;
}

export const ActivityCenterPage: React.FC<ActivityCenterPageProps> = ({
  classRecord,
  session,
  students,
  selections,
  questions,
  rewards,
  defaultSelectionMode,
  defaultRepeatPolicy,
  fairnessScope,
  onLaunchActivity,
  onEditAttendance,
}) => {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>(defaultSelectionMode);
  const [repeatPolicy, setRepeatPolicy] = useState<RepeatPolicy>(defaultRepeatPolicy);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [dutyTitle, setDutyTitle] = useState<string>(
    rewards.find((r) => r.kind === 'duty')?.text ?? 'Classroom Helper'
  );
  const [showMoreActivities, setShowMoreActivities] = useState(false);

  const primaryLaunchRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    // Pre-focus Mystery Pick for instant 3-tap or Enter-key classroom launch
    primaryLaunchRef.current?.focus();
  }, []);

  const activeStudents = students.filter(
    (s) => s.classId === classRecord.id && s.activeStatus === 'active'
  );
  const absentSet = new Set(session.absentStudentIds);
  const eligibleCount = activeStudents.filter((s) => !absentSet.has(s.id)).length;
  const subjects = Array.from(new Set(questions.map((q) => q.subject)));

  const dutyItems = useMemo(() => rewards.filter((r) => r.kind === 'duty'), [rewards]);
  const dutyCounts = useMemo(
    () => computeDutyTitleCounts(selections, classRecord.id),
    [selections, classRecord.id]
  );

  const primaryActivities: Array<{
    type: ActivityType;
    title: string;
    description: string;
    icon: React.ReactNode;
    primary?: boolean;
  }> = [
    {
      type: 'single_pick',
      title: 'Mystery Pick',
      description: 'Flip 3D student cards one by one.',
      icon: <Layers className="w-5 h-5" />,
      primary: true,
    },
    {
      type: 'two_toss',
      title: 'Two-Student Toss',
      description: 'Pick two students at once.',
      icon: <Scale className="w-5 h-5" />,
    },
    {
      type: 'groups',
      title: 'Team Builder',
      description: 'Split present students into balanced groups.',
      icon: <Users className="w-5 h-5" />,
    },
    {
      type: 'student_question',
      title: 'Student + Question',
      description: 'Pick a student with a question prompt.',
      icon: <HelpCircle className="w-5 h-5" />,
    },
    {
      type: 'lucky_picker',
      title: 'Duty Picker',
      description: 'Assign a classroom helper duty fairly.',
      icon: <Award className="w-5 h-5" />,
    },
  ];

  const selectedDutyCount = dutyCounts.get(dutyTitle.trim() || 'Classroom Helper') ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-hairline)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-[var(--ink)]">
            {classRecord.name} · Activities
          </h1>
          <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)] mt-0.5">
            <span className="text-[var(--sage)] font-semibold">{eligibleCount} present</span>
            <span aria-hidden="true">·</span>
            <span>{session.absentStudentIds.length} absent</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onEditAttendance}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer self-start sm:self-auto"
        >
          <UserCheck className="w-3.5 h-3.5 text-[var(--sage)]" />
          Attendance
        </button>
      </div>

      {/* Compact Top Fairness & Repeat Bar */}
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--ink-muted)]">Mode:</span>
          <div className="inline-flex rounded-lg bg-[var(--canvas)] p-0.5 border border-[var(--border-hairline)]">
            {[
              { id: 'pure_random', label: 'Random' },
              { id: 'balanced', label: 'Balanced' },
              { id: 'least_recent', label: 'Least Recent' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectionMode(m.id as SelectionMode)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  selectionMode === m.id
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs font-semibold'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--ink-muted)]">Repeats:</span>
          <div className="inline-flex rounded-lg bg-[var(--canvas)] p-0.5 border border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={() => setRepeatPolicy('no_repeat')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                repeatPolicy === 'no_repeat'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs font-semibold'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              No Repeat
            </button>
            <button
              type="button"
              onClick={() => setRepeatPolicy('allow_repeat')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                repeatPolicy === 'allow_repeat'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs font-semibold'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              Allow Repeat
            </button>
          </div>
        </div>
      </div>

      {/* 5 Primary Activities */}
      {eligibleCount === 0 ? (
        <div className="p-5 rounded-2xl bg-[var(--crimson-soft)] border border-[var(--crimson)]/30 text-sm text-[var(--crimson)]">
          Zero eligible students are marked present. Edit attendance above before starting an activity.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {primaryActivities.map((act) => {
              const disabled = act.type === 'two_toss' && eligibleCount < 2;
              return (
                <div
                  key={act.type}
                  style={{ boxShadow: 'var(--shadow-card)' }}
                  className={`rounded-2xl bg-[var(--surface)] border p-5 flex flex-col justify-between gap-4 transition-all ${
                    act.primary
                      ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/25'
                      : 'border-[var(--border-hairline)]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          act.primary
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-[var(--surface-subtle)] text-[var(--ink)]'
                        }`}
                      >
                        {act.icon}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-display font-bold text-[var(--ink)] leading-snug">
                          {act.title}
                        </h2>
                        <p className="mt-1 text-xs sm:text-sm text-[var(--ink-muted)] leading-relaxed">
                          {act.description}
                        </p>
                      </div>
                    </div>

                    {act.type === 'student_question' && (
                      <div>
                        <label htmlFor="act-subject" className="sr-only">
                          Question Deck Subject
                        </label>
                        <select
                          id="act-subject"
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)]"
                        >
                          <option value="all">All Subjects ({questions.length} questions)</option>
                          {subjects.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {act.type === 'lucky_picker' && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor="act-duty" className="text-[11px] font-medium text-[var(--ink-muted)]">
                            Duty Title
                          </label>
                          <span className="text-[11px] font-mono-tabular text-[var(--ink-muted)]">
                            Assigned {selectedDutyCount}x in {classRecord.name}
                          </span>
                        </div>
                        <input
                          id="act-duty"
                          type="text"
                          value={dutyTitle}
                          onChange={(e) => setDutyTitle(e.target.value)}
                          list="saved-duty-suggestions"
                          placeholder="Duty title (e.g. Board Helper)"
                          className="w-full px-3 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)]"
                        />
                        <datalist id="saved-duty-suggestions">
                          {dutyItems.map((d) => (
                            <option key={d.id} value={d.text} />
                          ))}
                        </datalist>
                      </div>
                    )}
                  </div>

                  <button
                    ref={act.primary ? primaryLaunchRef : undefined}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onLaunchActivity({
                        type: act.type,
                        selectionMode,
                        repeatPolicy: act.type === 'two_toss' ? 'no_repeat' : repeatPolicy,
                        questionSubject: selectedSubject,
                        dutyTitle: dutyTitle.trim() || 'Classroom Helper',
                      })
                    }
                    className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 transition-colors ${
                      act.primary
                        ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white'
                        : 'bg-[var(--surface-subtle)] hover:bg-[var(--accent)] hover:text-white text-[var(--ink)]'
                    }`}
                  >
                    <span>
                      {disabled
                        ? 'Needs 2+ Present Students'
                        : act.primary
                          ? 'Launch Mystery Pick'
                          : 'Open Activity'}
                    </span>
                    {!disabled && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Expandable More Activities Preserving Mystery Reward / Challenge */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowMoreActivities((v) => !v)}
              aria-expanded={showMoreActivities}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
            >
              {showMoreActivities ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              More Activities (Mystery Reward / Challenge)
            </button>

            {showMoreActivities && (
              <div className="mt-3 max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-display font-bold text-[var(--ink)]">
                      Mystery Reward / Challenge
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-[var(--ink-muted)]">
                      Reveal a saved classroom bonus or quick challenge after picking a student.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onLaunchActivity({
                      type: 'mystery_reward',
                      selectionMode,
                      repeatPolicy,
                    })
                  }
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--surface-subtle)] hover:bg-[var(--accent)] hover:text-white text-sm font-semibold text-[var(--ink)] cursor-pointer transition-colors"
                >
                  <span>Open Mystery Reward / Challenge</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
