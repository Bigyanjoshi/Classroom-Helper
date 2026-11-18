import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareRollNumbers,
  isSecureRandomAvailable,
  parseRollNumberInput,
  secureRandomInt,
  SecureRandomUnavailableError,
  shuffleArray,
  sortStudentsNaturally,
} from './random';
import type { Student } from './types';
import { generateAvatarConfig } from './avatarGenerator';

function makeStudent(id: string, roll: string, name: string, active = true): Student {
  return {
    id,
    classId: 'class-5',
    name,
    rollNumber: roll,
    characterPresentation: 'neutral',
    avatarSource: 'generated',
    avatarConfig: generateAvatarConfig('neutral'),
    activeStatus: active ? 'active' : 'archived',
    createdAt: 1000,
    updatedAt: 1000,
  };
}

test('secureRandomInt stays strictly within [0, maxExclusive)', () => {
  for (let i = 0; i < 200; i++) {
    const val = secureRandomInt(7);
    assert.ok(Number.isInteger(val) && val >= 0 && val < 7);
  }
  assert.equal(secureRandomInt(1), 0);
});

test('secureRandomInt throws SecureRandomUnavailableError when Web Crypto is missing (never falls back to Math.random)', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', {
    value: undefined,
    configurable: true,
    writable: true,
  });

  try {
    assert.equal(isSecureRandomAvailable(), false);
    assert.throws(() => secureRandomInt(10), SecureRandomUnavailableError);
    assert.throws(() => shuffleArray([1, 2, 3]), SecureRandomUnavailableError);
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'crypto', originalDescriptor);
    }
  }
  assert.equal(isSecureRandomAvailable(), true);
});

test('shuffleArray preserves exact multiset of elements without mutating source', () => {
  const original = [1, 2, 3, 4, 5, 6, 7, 8];
  const shuffled = shuffleArray(original);
  assert.deepEqual(original, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(shuffled.length, original.length);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), original);
});

test('sortStudentsNaturally orders numeric roll numbers naturally (1, 2, 10) rather than lexicographically', () => {
  const unsorted = [
    makeStudent('a', '10', 'Ten'),
    makeStudent('b', '2', 'Two'),
    makeStudent('c', '1', 'One'),
    makeStudent('d', '101', 'Hundred One'),
    makeStudent('e', '20', 'Twenty'),
  ];
  const sorted = sortStudentsNaturally(unsorted);
  assert.deepEqual(
    sorted.map((s) => s.rollNumber),
    ['1', '2', '10', '20', '101']
  );
  assert.ok(compareRollNumbers('2', '10') < 0);
});

test('parseRollNumberInput validates matched, duplicate, and unknown rolls', () => {
  const roster = [
    makeStudent('s1', '101', 'Aarav'),
    makeStudent('s2', '102', 'Meera'),
    makeStudent('s3', '103', 'Kabir'),
    makeStudent('s4', '104', 'Archived Kid', false),
  ];

  const res = parseRollNumberInput('101, 103 101; 999, 104', roster);
  assert.deepEqual(res.validStudentIds, ['s1', 's3']);
  assert.deepEqual(res.matchedRolls, ['101', '103']);
  assert.deepEqual(res.duplicateRolls, ['101']);
  assert.deepEqual(res.unknownRolls, ['999', '104']);
});
