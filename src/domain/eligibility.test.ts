import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDutyAssignmentCounts,
  computeDutyTitleCounts,
  computeFairnessWeights,
  createDeckSlots,
  distributeIntoGroups,
  getActivityDisplayLabel,
  getEligibleStudents,
  swapGroupMembers,
} from './eligibility';
import { generateAvatarConfig } from './avatarGenerator';
import type { ActivitySelection, ClassSession, Student } from './types';

function makeStudent(id: string, roll: string, classId = 'class-5'): Student {
  return {
    id,
    classId,
    name: `Student ${roll}`,
    rollNumber: roll,
    characterPresentation: 'neutral',
    avatarSource: 'generated',
    avatarConfig: generateAvatarConfig('neutral'),
    activeStatus: 'active',
    createdAt: 1000,
    updatedAt: 1000,
  };
}

test('getEligibleStudents excludes absent, archived, and already-selected in no_repeat', () => {
  const students = [
    makeStudent('s1', '1'),
    makeStudent('s2', '2'),
    makeStudent('s3', '3'),
    { ...makeStudent('s4', '4'), activeStatus: 'archived' as const },
    makeStudent('s5', '5', 'class-6'),
  ];
  const session: ClassSession = {
    id: 'sess-1',
    classId: 'class-5',
    startedAt: 1000,
    status: 'active',
    absentStudentIds: ['s2'],
    lateArrivalsIds: [],
  };

  const noRepeat = getEligibleStudents({
    students,
    session,
    alreadySelectedIds: ['s1'],
    repeatPolicy: 'no_repeat',
  });
  assert.deepEqual(noRepeat.map((s) => s.id), ['s3']);

  const allowRepeat = getEligibleStudents({
    students,
    session,
    alreadySelectedIds: ['s1'],
    repeatPolicy: 'allow_repeat',
  });
  assert.deepEqual(allowRepeat.map((s) => s.id), ['s1', 's3']);
});

test('computeFairnessWeights applies 1/(1+count) in balanced mode and uniform in pure_random', () => {
  const students = [makeStudent('s1', '1'), makeStudent('s2', '2')];
  const history: ActivitySelection[] = [
    {
      id: 'sel-1',
      activityId: 'act-1',
      sessionId: 'sess-1',
      classId: 'class-5',
      studentId: 's1',
      selectionOrder: 1,
      selectedAt: 1000,
    },
    {
      id: 'sel-2',
      activityId: 'act-1',
      sessionId: 'sess-1',
      classId: 'class-5',
      studentId: 's1',
      selectionOrder: 2,
      selectedAt: 2000,
    },
  ];

  const pure = computeFairnessWeights(students, history, 'pure_random');
  assert.equal(pure[0].probabilityShare, 0.5);
  assert.equal(pure[1].probabilityShare, 0.5);

  const balanced = computeFairnessWeights(students, history, 'balanced');
  assert.ok(Math.abs(balanced[0].probabilityShare - 0.25) < 1e-6);
  assert.ok(Math.abs(balanced[1].probabilityShare - 0.75) < 1e-6);
});

test('createDeckSlots maps every eligible student 1-to-1 and Team Builder supports member swapping', () => {
  const students = Array.from({ length: 6 }, (_, i) => makeStudent(`s${i + 1}`, `${i + 1}`));
  const weights = computeFairnessWeights(students, [], 'pure_random');
  const slots = createDeckSlots(students, 'pure_random', weights);
  assert.equal(slots.length, 6);
  assert.equal(new Set(slots.map((s) => s.studentId)).size, 6);
  assert.ok(slots.every((s) => s.state === 'hidden'));

  const groups = distributeIntoGroups(students, { mode: 'by_count', count: 2 });
  assert.equal(groups.length, 2);
  assert.equal(groups[0].name, 'Team 1');
  assert.equal(groups[1].name, 'Team 2');

  const firstTeamMember = groups[0].studentIds[0];
  const secondTeamMember = groups[1].studentIds[0];
  const swapped = swapGroupMembers(groups, 1, firstTeamMember, 2, secondTeamMember);
  assert.equal(swapped[0].studentIds.includes(secondTeamMember), true);
  assert.equal(swapped[1].studentIds.includes(firstTeamMember), true);
  assert.equal(new Set(swapped.flatMap((g) => g.studentIds)).size, 6);
});

test('duty counts exclude undone rows and activity display labels match Spec v2.0', () => {
  const selections: ActivitySelection[] = [
    {
      id: 'd1',
      activityId: 'a1',
      sessionId: 'sess-1',
      classId: 'class-5',
      studentId: 's1',
      selectionOrder: 1,
      selectedAt: 1000,
      dutyTitle: 'Board Helper',
    },
    {
      id: 'd2',
      activityId: 'a2',
      sessionId: 'sess-1',
      classId: 'class-5',
      studentId: 's1',
      selectionOrder: 2,
      selectedAt: 2000,
      dutyTitle: 'Line Leader',
      undoneAt: 2500,
    },
  ];

  const byStudent = computeDutyAssignmentCounts(selections, 'class-5');
  assert.equal(byStudent.get('s1')?.count, 1);
  assert.deepEqual(byStudent.get('s1')?.recentDuties, ['Board Helper']);

  const byTitle = computeDutyTitleCounts(selections, 'class-5');
  assert.equal(byTitle.get('Board Helper'), 1);
  assert.equal(byTitle.get('Line Leader'), undefined);

  assert.equal(getActivityDisplayLabel('single_pick'), 'Mystery Pick');
  assert.equal(getActivityDisplayLabel('groups'), 'Team Builder');
  assert.equal(getActivityDisplayLabel('lucky_picker'), 'Duty Picker');
});
