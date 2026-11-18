import { pickWeightedStudent, type StudentFairnessWeight } from './eligibility';
import { shuffleArray, type RandomSource } from './random';
import type { ActivityRecord, DeckSlot, SelectionMode } from './types';

export const CONFIRM_SETTLE_MS = 350;
export const SPOTLIGHT_HOLD_MS = 3500;
export const SPOTLIGHT_LIFT_MS = 360;
export const SPOTLIGHT_FLY_MS = 460;

export function canConfirmPendingReveal(
  pendingRevealedAt: number | undefined,
  now = Date.now(),
  settleMs = CONFIRM_SETTLE_MS
): boolean {
  if (typeof pendingRevealedAt !== 'number') return true;
  return now - pendingRevealedAt >= settleMs;
}

/**
 * Computes remaining spotlight reveal duration when resuming a persisted
 * `pending_reveal` slot after a page reload. Always keeps at least `minRecoveryHoldMs`
 * so the teacher can review and optionally Cancel before auto-confirmation runs.
 */
export function computeRemainingSpotlightHoldMs(
  pendingRevealedAt: number | undefined,
  now = Date.now(),
  holdMs = SPOTLIGHT_HOLD_MS,
  minRecoveryHoldMs = 1200
): number {
  if (typeof pendingRevealedAt !== 'number') return holdMs;
  const elapsed = Math.max(0, now - pendingRevealedAt);
  return Math.max(minRecoveryHoldMs, holdMs - elapsed);
}

export type RevealSlotOutcome =
  | { ok: true; slots: DeckSlot[]; revealedStudentId: string; revealedAt: number }
  | { ok: false; reason: 'already_pending'; pendingSlotIndex: number }
  | { ok: false; reason: 'slot_not_hidden' }
  | { ok: false; reason: 'invalid_slot' };

/**
 * First tap — Reveal:
 * Enforces that only ONE card can be in `pending_reveal` state at a time.
 * In Balanced or Least Recently Selected modes, swaps a weighted-sampled hidden
 * student into the tapped slot so selection probability matches fairness weights.
 */
export function revealDeckSlot(
  slots: readonly DeckSlot[],
  slotIndex: number,
  selectionMode: SelectionMode,
  fairnessWeights: readonly StudentFairnessWeight[],
  rng?: RandomSource,
  now = Date.now()
): RevealSlotOutcome {
  const target = slots.find((s) => s.slotIndex === slotIndex);
  if (!target) {
    return { ok: false, reason: 'invalid_slot' };
  }

  const existingPending = slots.find((s) => s.state === 'pending_reveal');
  if (existingPending) {
    if (existingPending.slotIndex === slotIndex) {
      return { ok: false, reason: 'slot_not_hidden' };
    }
    return { ok: false, reason: 'already_pending', pendingSlotIndex: existingPending.slotIndex };
  }

  if (target.state !== 'hidden' || !target.studentId) {
    return { ok: false, reason: 'slot_not_hidden' };
  }

  const nextSlots = slots.map((s) => ({ ...s }));
  const targetIdx = nextSlots.findIndex((s) => s.slotIndex === slotIndex);

  if (selectionMode !== 'pure_random') {
    const hiddenStudentIds = new Set(
      nextSlots.filter((s) => s.state === 'hidden' && s.studentId).map((s) => s.studentId as string)
    );
    const hiddenWeights = fairnessWeights.filter((w) => hiddenStudentIds.has(w.studentId));
    const chosenId = pickWeightedStudent(hiddenWeights, rng);
    if (chosenId && chosenId !== nextSlots[targetIdx].studentId) {
      const donorIdx = nextSlots.findIndex((s) => s.state === 'hidden' && s.studentId === chosenId);
      if (donorIdx !== -1) {
        const temp = nextSlots[targetIdx].studentId;
        nextSlots[targetIdx].studentId = nextSlots[donorIdx].studentId;
        nextSlots[donorIdx].studentId = temp;
      }
    }
  }

  nextSlots[targetIdx].state = 'pending_reveal';
  const revealedStudentId = nextSlots[targetIdx].studentId as string;

  return {
    ok: true,
    slots: nextSlots,
    revealedStudentId,
    revealedAt: now,
  };
}

/**
 * Cancels the current pending reveal and returns the card face-down.
 */
export function cancelPendingReveal(slots: readonly DeckSlot[]): DeckSlot[] {
  return slots.map((s) => (s.state === 'pending_reveal' ? { ...s, state: 'hidden' } : { ...s }));
}

export interface ConfirmOutcome {
  ok: boolean;
  reason?: 'no_pending_reveal' | 'too_soon_to_confirm' | 'duplicate_in_pair' | 'pair_complete';
  confirmedStudentId?: string;
  activity: ActivityRecord;
}

/**
 * Second tap — Confirm:
 * Enforces the 350ms minimum settle lock after reveal so accidental double-taps
 * do not confirm immediately, then moves studentId to `selectedStudentIds`.
 */
export function confirmPendingReveal(
  activity: ActivityRecord,
  now = Date.now(),
  rng?: RandomSource
): ConfirmOutcome {
  const pendingIdx = activity.deckSlots.findIndex((s) => s.state === 'pending_reveal');
  if (pendingIdx === -1) {
    return { ok: false, reason: 'no_pending_reveal', activity };
  }

  if (!canConfirmPendingReveal(activity.pendingRevealedAt, now)) {
    return { ok: false, reason: 'too_soon_to_confirm', activity };
  }

  const studentId = activity.deckSlots[pendingIdx].studentId;
  if (!studentId) {
    return { ok: false, reason: 'no_pending_reveal', activity };
  }

  if (activity.type === 'two_toss') {
    if (activity.selectedStudentIds.length >= 2) {
      return { ok: false, reason: 'pair_complete', activity };
    }
    if (activity.selectedStudentIds.includes(studentId)) {
      return { ok: false, reason: 'duplicate_in_pair', activity };
    }
  }

  let nextSlots: DeckSlot[];
  if (activity.repeatPolicy === 'allow_repeat' && activity.type !== 'two_toss') {
    const hiddenIndices: number[] = [];
    const hiddenStudents: string[] = [];
    nextSlots = activity.deckSlots.map((s, idx) => {
      if (idx === pendingIdx) {
        return { ...s, state: 'hidden' as const };
      }
      return { ...s };
    });
    nextSlots.forEach((s, idx) => {
      if (s.state === 'hidden' && s.studentId) {
        hiddenIndices.push(idx);
        hiddenStudents.push(s.studentId);
      }
    });
    const reshuffled = shuffleArray(hiddenStudents, rng);
    hiddenIndices.forEach((slotPos, i) => {
      nextSlots[slotPos].studentId = reshuffled[i];
    });
  } else {
    nextSlots = activity.deckSlots.map((s, idx) =>
      idx === pendingIdx ? { ...s, studentId: null, state: 'empty' as const } : { ...s }
    );
  }

  const nextSelected = [...activity.selectedStudentIds, studentId];
  const remainingHidden = nextSlots.filter((s) => s.state === 'hidden').length;

  const isCompleted =
    activity.type === 'two_toss'
      ? nextSelected.length >= 2 || remainingHidden === 0
      : activity.type === 'lucky_picker'
        ? nextSelected.length >= 1
        : remainingHidden === 0;

  return {
    ok: true,
    confirmedStudentId: studentId,
    activity: {
      ...activity,
      deckSlots: nextSlots,
      selectedStudentIds: nextSelected,
      pendingRevealedAt: undefined,
      status: isCompleted ? 'completed' : 'in_progress',
      completedAt: isCompleted ? now : undefined,
    },
  };
}

/**
 * Undoes the most recent confirmed selection.
 * Restores that student into an empty slot (and shuffles hidden slots so
 * other hidden cards aren't exposed by position deduction).
 */
export function undoLastSelection(
  activity: ActivityRecord,
  isStudentStillEligible: (studentId: string) => boolean,
  rng?: RandomSource
): { activity: ActivityRecord; undoneStudentId: string | null } {
  if (activity.selectedStudentIds.length === 0) {
    return { activity, undoneStudentId: null };
  }

  const undoneStudentId = activity.selectedStudentIds[activity.selectedStudentIds.length - 1];
  const nextSelected = activity.selectedStudentIds.slice(0, -1);
  let nextSlots: DeckSlot[] = activity.deckSlots.map((s) => ({
    ...s,
    state: s.state === 'pending_reveal' ? ('hidden' as const) : s.state,
  }));

  const alreadyInDeck = nextSlots.some((s) => s.studentId === undoneStudentId);
  if (!alreadyInDeck && isStudentStillEligible(undoneStudentId)) {
    const emptyIdx = nextSlots.findIndex((s) => s.state === 'empty');
    if (emptyIdx !== -1) {
      nextSlots[emptyIdx] = {
        ...nextSlots[emptyIdx],
        studentId: undoneStudentId,
        state: 'hidden',
      };
    } else {
      nextSlots.push({
        slotIndex: nextSlots.length,
        studentId: undoneStudentId,
        cardBackVariant: nextSlots.length % 6,
        state: 'hidden',
      });
    }
  }

  nextSlots = reshuffleRemainingSlots(nextSlots, rng);

  return {
    undoneStudentId,
    activity: {
      ...activity,
      deckSlots: nextSlots,
      selectedStudentIds: nextSelected,
      pendingRevealedAt: undefined,
      status: 'in_progress',
      completedAt: undefined,
    },
  };
}

/**
 * Reshuffles only hidden cards and card-back designs independently.
 * Preserves empty slots and confirmed selected students.
 */
export function reshuffleRemainingSlots(
  slots: readonly DeckSlot[],
  rng?: RandomSource,
  cardBackVariantCount = 6
): DeckSlot[] {
  const next: DeckSlot[] = slots.map((s) => ({
    ...s,
    state: s.state === 'pending_reveal' ? ('hidden' as const) : s.state,
  }));

  const hiddenIndices: number[] = [];
  const hiddenStudentIds: string[] = [];

  next.forEach((slot, idx) => {
    if (slot.state === 'hidden' && slot.studentId) {
      hiddenIndices.push(idx);
      hiddenStudentIds.push(slot.studentId);
    }
  });

  const shuffledStudents = shuffleArray(hiddenStudentIds, rng);
  const shuffledBacks = shuffleArray(
    hiddenIndices.map((_, i) => i % cardBackVariantCount),
    rng
  );

  hiddenIndices.forEach((pos, idx) => {
    next[pos] = {
      ...next[pos],
      studentId: shuffledStudents[idx],
      cardBackVariant: shuffledBacks[idx],
    };
  });

  return next;
}
