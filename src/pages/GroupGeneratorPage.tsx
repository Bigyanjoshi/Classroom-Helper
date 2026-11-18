import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Check, Layers, Printer, RefreshCw, Users } from 'lucide-react';
import { distributeIntoGroups, swapGroupMembers } from '../domain/eligibility';
import type { ClassRecord, ClassSession, GeneratedGroup, Student } from '../domain/types';
import { StudentAvatar } from '../components/StudentAvatar';

interface GroupGeneratorPageProps {
  classRecord: ClassRecord;
  session: ClassSession;
  students: Student[];
  onSaveConfirmedGroups: (groups: GeneratedGroup[]) => Promise<void>;
  onSwitchActivity: () => void;
}

export const GroupGeneratorPage: React.FC<GroupGeneratorPageProps> = ({
  classRecord,
  session,
  students,
  onSaveConfirmedGroups,
  onSwitchActivity,
}) => {
  const absentSet = useMemo(() => new Set(session.absentStudentIds), [session.absentStudentIds]);
  const eligibleStudents = useMemo(
    () =>
      students.filter(
        (s) =>
          s.classId === classRecord.id &&
          s.activeStatus === 'active' &&
          !absentSet.has(s.id)
      ),
    [students, classRecord.id, absentSet]
  );

  const studentMap = useMemo(
    () => new Map(eligibleStudents.map((s) => [s.id, s])),
    [eligibleStudents]
  );

  const [splitMode, setSplitMode] = useState<'by_count' | 'by_size'>('by_count');
  const [countValue, setCountValue] = useState(3);
  const [sizeValue, setSizeValue] = useState(3);
  const [groups, setGroups] = useState<GeneratedGroup[]>(() =>
    distributeIntoGroups(eligibleStudents, { mode: 'by_count', count: 3 })
  );
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  const regenerate = (nextMode = splitMode, nextCount = countValue, nextSize = sizeValue) => {
    setSavedConfirmed(false);
    setSwapSourceId(null);
    const next = distributeIntoGroups(
      eligibleStudents,
      nextMode === 'by_count'
        ? { mode: 'by_count', count: nextCount }
        : { mode: 'by_size', size: nextSize }
    );
    setGroups(next);
  };

  const handleMemberClick = (studentId: string) => {
    if (savedConfirmed) return;
    if (!swapSourceId) {
      setSwapSourceId(studentId);
      return;
    }
    if (swapSourceId === studentId) {
      setSwapSourceId(null);
      return;
    }
    setGroups((prev) => {
      const srcGroup = prev.find((g) => g.studentIds.includes(swapSourceId));
      const tgtGroup = prev.find((g) => g.studentIds.includes(studentId));
      if (!srcGroup || !tgtGroup) return prev;
      return swapGroupMembers(prev, srcGroup.groupNumber, swapSourceId, tgtGroup.groupNumber, studentId);
    });
    setSwapSourceId(null);
  };

  const handleConfirmSave = async () => {
    setSwapSourceId(null);
    await onSaveConfirmedGroups(groups);
    setSavedConfirmed(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-[var(--ink-muted)]">
            {classRecord.name} · {eligibleStudents.length} eligible students
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--ink)] mt-1">
            Team Builder
          </h1>
          <p className="text-xs sm:text-sm text-[var(--ink-muted)] mt-0.5">
            Generate balanced teams and tap any two students to swap places before saving.
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2 self-start">
          <button
            type="button"
            onClick={onSwitchActivity}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-xs sm:text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            <Layers className="w-4 h-4 text-[var(--accent)]" />
            Switch Activity
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface)] text-xs sm:text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Teams
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="no-print rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-5 flex flex-wrap items-end gap-5">
        <div>
          <span className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">Split Method</span>
          <div className="inline-flex p-1 rounded-xl bg-[var(--surface-subtle)]">
            <button
              type="button"
              onClick={() => {
                setSplitMode('by_count');
                regenerate('by_count', countValue, sizeValue);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                splitMode === 'by_count'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                  : 'text-[var(--ink-muted)]'
              }`}
            >
              Number of Teams
            </button>
            <button
              type="button"
              onClick={() => {
                setSplitMode('by_size');
                regenerate('by_size', countValue, sizeValue);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                splitMode === 'by_size'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                  : 'text-[var(--ink-muted)]'
              }`}
            >
              Students per Team
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="grp-num" className="block text-xs font-medium text-[var(--ink-muted)] mb-1.5">
            {splitMode === 'by_count' ? 'How many teams?' : 'Target students per team'}
          </label>
          <input
            id="grp-num"
            type="number"
            min={1}
            max={Math.max(1, eligibleStudents.length)}
            value={splitMode === 'by_count' ? countValue : sizeValue}
            onChange={(e) => {
              const val = Math.max(1, Number(e.target.value) || 1);
              if (splitMode === 'by_count') {
                setCountValue(val);
                regenerate('by_count', val, sizeValue);
              } else {
                setSizeValue(val);
                regenerate('by_size', countValue, val);
              }
            }}
            className="w-28 px-3 py-2 rounded-xl bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm font-mono-tabular"
          />
        </div>

        <div className="flex items-center gap-3 ml-auto flex-wrap">
          <button
            type="button"
            onClick={() => regenerate()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-hairline)] text-sm font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Shuffle Again
          </button>
          <button
            type="button"
            disabled={savedConfirmed || groups.length === 0}
            onClick={handleConfirmSave}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer disabled:opacity-60"
          >
            <Check className="w-4 h-4" />
            {savedConfirmed ? 'Teams Saved to Session' : 'Confirm & Save Teams'}
          </button>
        </div>
      </div>

      {swapSourceId && (
        <div className="no-print px-4 py-2.5 rounded-xl bg-[var(--gold-soft)] border border-[var(--gold)]/35 text-xs font-medium text-[var(--ink)] flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-[var(--gold)]" />
            Swapping <strong>{studentMap.get(swapSourceId)?.name}</strong> — tap another student to swap teams.
          </span>
          <button
            type="button"
            onClick={() => setSwapSourceId(null)}
            className="underline font-semibold cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((grp) => (
          <div
            key={grp.groupNumber}
            className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-5"
          >
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-hairline)]">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--accent)]" />
                <h2 className="text-base font-display font-bold text-[var(--ink)]">{grp.name}</h2>
              </div>
              <span className="text-xs font-mono-tabular text-[var(--ink-muted)]">
                {grp.studentIds.length} members
              </span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {grp.studentIds.map((id) => {
                const s = studentMap.get(id);
                if (!s) return null;
                const isSelectedSwap = swapSourceId === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      disabled={savedConfirmed}
                      onClick={() => handleMemberClick(id)}
                      className={`w-full flex items-center gap-3 p-1.5 rounded-xl text-left transition-colors ${
                        savedConfirmed ? '' : 'hover:bg-[var(--surface-subtle)] cursor-pointer'
                      } ${isSelectedSwap ? 'bg-[var(--gold-soft)] ring-1 ring-[var(--gold)]' : ''}`}
                    >
                      <StudentAvatar student={s} className="w-9 h-9 rounded-lg shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[var(--ink)] truncate">{s.name}</div>
                        <div className="text-xs font-mono-tabular text-[var(--ink-muted)]">
                          Roll {s.rollNumber}
                        </div>
                      </div>
                      {!savedConfirmed && (
                        <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--ink-muted)] opacity-50 shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
