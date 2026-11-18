import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelPendingReveal,
  canConfirmPendingReveal,
  computeRemainingSpotlightHoldMs,
  CONFIRM_SETTLE_MS,
  confirmPendingReveal,
  reshuffleRemainingSlots,
  revealDeckSlot,
  SPOTLIGHT_HOLD_MS,
  undoLastSelection,
} from './deckStateMachine';
import type { ActivityRecord, DeckSlot } from './types';

function makeActivity(overrides?: Partial<ActivityRecord>): ActivityRecord {
  const deckSlots: DeckSlot[] = [
    { slotIndex: 0, studentId: 's1', cardBackVariant: 0, state: 'hidden' },
    { slotIndex: 1, studentId: 's2', cardBackVariant: 1, state: 'hidden' },
    { slotIndex: 2, studentId: 's3', cardBackVariant: 2, state: 'hidden' },
  ];
  return {
    id: 'act-1',
    sessionId: 'sess-1',
    classId: 'class-5',
    type: 'single_pick',
    selectionMode: 'pure_random',
    repeatPolicy: 'no_repeat',
    fairnessScope: 'current_session',
    status: 'in_progress',
    deckSlots,
    selectedStudentIds: [],
    createdAt: 1000,
    ...overrides,
  };
}

test('two-tap reveal -> confirm enforces 350ms settle lock, leaves empty slot, and blocks simultaneous reveals', () => {
  let activity = makeActivity();

  // First tap reveals slot 1 at t=10000
  const r1 = revealDeckSlot(activity.deckSlots, 1, 'pure_random', [], undefined, 10_000);
  assert.equal(r1.ok, true);
  if (!r1.ok) return;
  activity = { ...activity, deckSlots: r1.slots, pendingRevealedAt: r1.revealedAt };
  assert.equal(activity.deckSlots[1].state, 'pending_reveal');
  assert.equal(canConfirmPendingReveal(activity.pendingRevealedAt, 10_150), false);
  assert.equal(canConfirmPendingReveal(activity.pendingRevealedAt, 10_000 + CONFIRM_SETTLE_MS), true);

  // Confirming too early (<350ms) must be rejected safely
  const earlyConfirm = confirmPendingReveal(activity, 10_150);
  assert.equal(earlyConfirm.ok, false);
  assert.equal(earlyConfirm.reason, 'too_soon_to_confirm');

  // Tapping another hidden card while slot 1 is pending must be rejected safely
  const rOther = revealDeckSlot(activity.deckSlots, 0, 'pure_random', []);
  assert.equal(rOther.ok, false);
  if (!rOther.ok) {
    assert.equal(rOther.reason, 'already_pending');
    assert.equal(rOther.pendingSlotIndex, 1);
  }

  // Cancel returns card face-down
  const cancelled = cancelPendingReveal(activity.deckSlots);
  assert.equal(cancelled[1].state, 'hidden');

  // Reveal again and Confirm after settle lock (second tap)
  const r2 = revealDeckSlot(cancelled, 1, 'pure_random', [], undefined, 20_000);
  assert.equal(r2.ok, true);
  if (!r2.ok) return;
  const confirmed = confirmPendingReveal(
    { ...activity, deckSlots: r2.slots, pendingRevealedAt: r2.revealedAt },
    20_000 + CONFIRM_SETTLE_MS
  );
  assert.equal(confirmed.ok, true);
  assert.deepEqual(confirmed.activity.selectedStudentIds, ['s2']);
  assert.equal(confirmed.activity.deckSlots[1].state, 'empty');
  assert.equal(confirmed.activity.deckSlots[1].studentId, null);

  // Undo restores student to deck and clears selected list
  const undone = undoLastSelection(confirmed.activity, () => true);
  assert.equal(undone.undoneStudentId, 's2');
  assert.deepEqual(undone.activity.selectedStudentIds, []);
  const deckStudentIds = undone.activity.deckSlots.map((s) => s.studentId).filter(Boolean).sort();
  assert.deepEqual(deckStudentIds, ['s1', 's2', 's3']);
});

test('allow_repeat keeps student pool filled cleanly after confirmation', () => {
  const activity = makeActivity({ repeatPolicy: 'allow_repeat' });
  const r1 = revealDeckSlot(activity.deckSlots, 0, 'pure_random', [], undefined, 1_000);
  assert.equal(r1.ok, true);
  if (!r1.ok) return;

  const confirmed = confirmPendingReveal(
    { ...activity, deckSlots: r1.slots, pendingRevealedAt: r1.revealedAt },
    2_000
  );
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.activity.selectedStudentIds.length, 1);
  assert.ok(confirmed.activity.deckSlots.every((s) => s.state === 'hidden' && s.studentId !== null));
});

test('two_toss completes after 2 sequential picks and never duplicates a student', () => {
  let activity = makeActivity({ type: 'two_toss' });

  const r1 = revealDeckSlot(activity.deckSlots, 0, 'pure_random', [], undefined, 1_000);
  assert.equal(r1.ok, true);
  if (!r1.ok) return;
  const c1 = confirmPendingReveal(
    { ...activity, deckSlots: r1.slots, pendingRevealedAt: r1.revealedAt },
    2_000
  );
  assert.equal(c1.ok, true);
  assert.equal(c1.activity.status, 'in_progress');

  const r2 = revealDeckSlot(c1.activity.deckSlots, 2, 'pure_random', [], undefined, 3_000);
  assert.equal(r2.ok, true);
  if (!r2.ok) return;
  const c2 = confirmPendingReveal(
    { ...c1.activity, deckSlots: r2.slots, pendingRevealedAt: r2.revealedAt },
    4_000
  );
  assert.equal(c2.ok, true);
  assert.equal(c2.activity.status, 'completed');
  assert.equal(new Set(c2.activity.selectedStudentIds).size, 2);
});

test('reshuffleRemainingSlots preserves empty slots and confirmed students', () => {
  const slots: DeckSlot[] = [
    { slotIndex: 0, studentId: null, cardBackVariant: 0, state: 'empty' },
    { slotIndex: 1, studentId: 's2', cardBackVariant: 1, state: 'hidden' },
    { slotIndex: 2, studentId: 's3', cardBackVariant: 2, state: 'hidden' },
  ];
  const reshuffled = reshuffleRemainingSlots(slots);
  assert.equal(reshuffled[0].state, 'empty');
  assert.equal(reshuffled[0].studentId, null);
  assert.deepEqual(
    reshuffled
      .filter((s) => s.state === 'hidden')
      .map((s) => s.studentId)
      .sort(),
    ['s2', 's3']
  );
});

test('cinematic spotlight 3.5s hold recovers cleanly on reload and blocks rapid re-reveals', () => {
  assert.equal(SPOTLIGHT_HOLD_MS, 3500);
  assert.equal(computeRemainingSpotlightHoldMs(10_000, 11_000), 2500);
  assert.equal(computeRemainingSpotlightHoldMs(10_000, 20_000), 1200);
  assert.equal(computeRemainingSpotlightHoldMs(undefined, 20_000), 3500);

  const activity = makeActivity();
  const revealed = revealDeckSlot(activity.deckSlots, 2, 'pure_random', [], undefined, 50_000);
  assert.equal(revealed.ok, true);
  if (!revealed.ok) return;

  // Rapid repeated tap on same slot or another slot is blocked safely
  const rapidSame = revealDeckSlot(revealed.slots, 2, 'pure_random', []);
  assert.equal(rapidSame.ok, false);
  const rapidOther = revealDeckSlot(revealed.slots, 0, 'pure_random', []);
  assert.equal(rapidOther.ok, false);

  // Auto-confirm after 3.5s spotlight passes settle lock and leaves empty slot at original position
  const autoConfirmed = confirmPendingReveal(
    { ...activity, deckSlots: revealed.slots, pendingRevealedAt: revealed.revealedAt },
    50_000 + SPOTLIGHT_HOLD_MS
  );
  assert.equal(autoConfirmed.ok, true);
  assert.equal(autoConfirmed.confirmedStudentId, 's3');
  assert.equal(autoConfirmed.activity.deckSlots[2].state, 'empty');
  assert.deepEqual(autoConfirmed.activity.selectedStudentIds, ['s3']);
});
