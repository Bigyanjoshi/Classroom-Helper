import { secureRandomFloat, shuffleArray, type RandomSource } from './random';
import type {
  ActivitySelection,
  ActivityType,
  ClassSession,
  DeckSlot,
  FairnessScope,
  GeneratedGroup,
  RepeatPolicy,
  SelectionMode,
  Student,
} from './types';

export interface EligibilityOptions {
  students: readonly Student[];
  session: ClassSession;
  alreadySelectedIds: readonly string[];
  repeatPolicy: RepeatPolicy;
  excludeIds?: readonly string[];
}

export function getActivityDisplayLabel(type: ActivityType): string {
  switch (type) {
    case 'single_pick':
      return 'Mystery Pick';
    case 'two_toss':
      return 'Two-Student Toss';
    case 'groups':
      return 'Team Builder';
    case 'student_question':
      return 'Student + Question';
    case 'lucky_picker':
      return 'Duty Picker';
    case 'mystery_reward':
      return 'Mystery Reward / Challenge';
  }
}

/**
 * Returns only active students in the session's class who are NOT absent,
 * NOT excluded explicitly, and (if no_repeat) NOT already selected in the activity.
 */
export function getEligibleStudents({
  students,
  session,
  alreadySelectedIds,
  repeatPolicy,
  excludeIds = [],
}: EligibilityOptions): Student[] {
  const absentSet = new Set(session.absentStudentIds);
  const excludeSet = new Set(excludeIds);
  const selectedSet = repeatPolicy === 'no_repeat' ? new Set(alreadySelectedIds) : new Set<string>();

  return students.filter(
    (s) =>
      s.classId === session.classId &&
      s.activeStatus === 'active' &&
      !absentSet.has(s.id) &&
      !excludeSet.has(s.id) &&
      !selectedSet.has(s.id)
  );
}

export interface StudentFairnessWeight {
  studentId: string;
  selectionCount: number;
  lastSelectedAt: number | null;
  weight: number;
  probabilityShare: number;
}

/**
 * Filters selection history according to the configured fairness scope
 * and excludes undone selections.
 */
export function filterHistoryByScope(
  selections: readonly ActivitySelection[],
  classId: string,
  scope: FairnessScope,
  currentSessionId: string,
  recentSessionIds: readonly string[]
): ActivitySelection[] {
  const activeSelections = selections.filter((sel) => sel.classId === classId && !sel.undoneAt);
  if (scope === 'current_session') {
    return activeSelections.filter((sel) => sel.sessionId === currentSessionId);
  }
  if (scope === 'recent_sessions') {
    const recentSet = new Set(recentSessionIds);
    recentSet.add(currentSessionId);
    return activeSelections.filter((sel) => recentSet.has(sel.sessionId));
  }
  return activeSelections;
}

/**
 * Computes transparent selection weights per eligible student:
 * - pure_random: uniform weight = 1
 * - balanced: inverse count weight = 1 / (1 + count)
 * - least_recent: prioritizes students never selected or selected earliest
 */
export function computeFairnessWeights(
  eligibleStudents: readonly Student[],
  scopedSelections: readonly ActivitySelection[],
  mode: SelectionMode
): StudentFairnessWeight[] {
  const counts = new Map<string, number>();
  const lastSelected = new Map<string, number>();

  for (const sel of scopedSelections) {
    counts.set(sel.studentId, (counts.get(sel.studentId) ?? 0) + 1);
    const prev = lastSelected.get(sel.studentId) ?? 0;
    if (sel.selectedAt > prev) {
      lastSelected.set(sel.studentId, sel.selectedAt);
    }
  }

  const raw = eligibleStudents.map((s) => {
    const count = counts.get(s.id) ?? 0;
    const last = lastSelected.get(s.id) ?? null;
    let weight = 1;
    if (mode === 'balanced') {
      weight = 1 / (1 + count);
    } else if (mode === 'least_recent') {
      weight = last === null ? 4 : 1 / (1 + count);
    }
    return {
      studentId: s.id,
      selectionCount: count,
      lastSelectedAt: last,
      weight,
    };
  });

  if (mode === 'least_recent' && raw.length > 0) {
    const selectedEntries = raw
      .filter((r) => r.lastSelectedAt !== null)
      .sort((a, b) => (a.lastSelectedAt ?? 0) - (b.lastSelectedAt ?? 0));
    const maxRank = selectedEntries.length;
    selectedEntries.forEach((entry, idx) => {
      entry.weight = 1 + (maxRank - idx) * 0.4;
    });
    for (const entry of raw) {
      if (entry.lastSelectedAt === null) {
        entry.weight = Math.max(3, 1 + maxRank * 0.6);
      }
    }
  }

  const totalWeight = raw.reduce((sum, item) => sum + item.weight, 0) || 1;
  return raw.map((item) => ({
    ...item,
    probabilityShare: item.weight / totalWeight,
  }));
}

/**
 * Picks one student using weighted random sampling without replacement.
 */
export function pickWeightedStudent(
  weights: readonly StudentFairnessWeight[],
  rng?: RandomSource
): string | null {
  if (weights.length === 0) return null;
  const total = weights.reduce((acc, w) => acc + w.weight, 0);
  if (total <= 0) return weights[0].studentId;

  const r = secureRandomFloat(rng) * total;
  let cumulative = 0;
  for (const w of weights) {
    cumulative += w.weight;
    if (r < cumulative) {
      return w.studentId;
    }
  }
  return weights[weights.length - 1].studentId;
}

/**
 * Orders eligible students for deck placement and shuffles card backs independently.
 */
export function createDeckSlots(
  eligibleStudents: readonly Student[],
  _mode: SelectionMode,
  _fairnessWeights: readonly StudentFairnessWeight[],
  cardBackVariantCount = 6,
  rng?: RandomSource
): DeckSlot[] {
  if (eligibleStudents.length === 0) return [];

  const orderedIds = shuffleArray(eligibleStudents, rng).map((s) => s.id);
  const variants = orderedIds.map((_, idx) => idx % cardBackVariantCount);
  const shuffledVariants = shuffleArray(variants, rng);

  return orderedIds.map((studentId, slotIndex) => ({
    slotIndex,
    studentId,
    cardBackVariant: shuffledVariants[slotIndex],
    state: 'hidden',
  }));
}

/**
 * Distributes eligible students fairly into groups by either target group count or target group size.
 */
export function distributeIntoGroups(
  eligibleStudents: readonly Student[],
  options: { mode: 'by_count'; count: number } | { mode: 'by_size'; size: number },
  rng?: RandomSource
): GeneratedGroup[] {
  if (eligibleStudents.length === 0) return [];

  const shuffled = shuffleArray(eligibleStudents, rng);
  let numGroups = 1;

  if (options.mode === 'by_count') {
    numGroups = Math.max(1, Math.min(shuffled.length, Math.floor(options.count)));
  } else {
    const size = Math.max(1, Math.floor(options.size));
    numGroups = Math.max(1, Math.ceil(shuffled.length / size));
  }

  const groups: GeneratedGroup[] = Array.from({ length: numGroups }, (_, idx) => ({
    groupNumber: idx + 1,
    name: `Team ${idx + 1}`,
    studentIds: [],
  }));

  shuffled.forEach((student, idx) => {
    groups[idx % numGroups].studentIds.push(student.id);
  });

  return groups;
}

/**
 * Swaps two students across different teams (or moves one student into target team)
 * before confirming & saving in Team Builder.
 */
export function swapGroupMembers(
  groups: readonly GeneratedGroup[],
  sourceGroupNum: number,
  sourceStudentId: string,
  targetGroupNum: number,
  targetStudentId?: string
): GeneratedGroup[] {
  if (sourceGroupNum === targetGroupNum && !targetStudentId) {
    return groups.map((g) => ({ ...g, studentIds: [...g.studentIds] }));
  }

  const next = groups.map((g) => ({ ...g, studentIds: [...g.studentIds] }));
  const srcGroup = next.find((g) => g.groupNumber === sourceGroupNum);
  const tgtGroup = next.find((g) => g.groupNumber === targetGroupNum);
  if (!srcGroup || !tgtGroup) return next;

  const srcIdx = srcGroup.studentIds.indexOf(sourceStudentId);
  if (srcIdx === -1) return next;

  if (targetStudentId) {
    const tgtIdx = tgtGroup.studentIds.indexOf(targetStudentId);
    if (tgtIdx === -1) return next;
    srcGroup.studentIds[srcIdx] = targetStudentId;
    tgtGroup.studentIds[tgtIdx] = sourceStudentId;
  } else {
    srcGroup.studentIds.splice(srcIdx, 1);
    tgtGroup.studentIds.push(sourceStudentId);
  }

  return next;
}

/**
 * Computes how many classroom duties each student has been assigned (excluding undone rows).
 */
export function computeDutyAssignmentCounts(
  selections: readonly ActivitySelection[],
  classId?: string
): Map<string, { count: number; lastAssignedAt: number | null; recentDuties: string[] }> {
  const result = new Map<string, { count: number; lastAssignedAt: number | null; recentDuties: string[] }>();
  const sorted = [...selections]
    .filter((s) => !s.undoneAt && Boolean(s.dutyTitle) && (!classId || s.classId === classId))
    .sort((a, b) => a.selectedAt - b.selectedAt);

  for (const sel of sorted) {
    const prev = result.get(sel.studentId) ?? { count: 0, lastAssignedAt: null, recentDuties: [] };
    prev.count += 1;
    prev.lastAssignedAt = sel.selectedAt;
    if (sel.dutyTitle) {
      prev.recentDuties.push(sel.dutyTitle);
    }
    result.set(sel.studentId, prev);
  }
  return result;
}

/**
 * Computes how many times each duty title (e.g. "Board Helper") has been assigned.
 */
export function computeDutyTitleCounts(
  selections: readonly ActivitySelection[],
  classId?: string
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const sel of selections) {
    if (sel.undoneAt || !sel.dutyTitle) continue;
    if (classId && sel.classId !== classId) continue;
    counts.set(sel.dutyTitle, (counts.get(sel.dutyTitle) ?? 0) + 1);
  }
  return counts;
}

