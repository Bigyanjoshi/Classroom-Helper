import type { Student } from './types';

export type RandomSource = () => number;

export class SecureRandomUnavailableError extends Error {
  constructor() {
    super(
      'Cryptographically secure randomness (Web Crypto API) is unavailable in this browser. Fair random selection cannot proceed safely.'
    );
    this.name = 'SecureRandomUnavailableError';
  }
}

export function isSecureRandomAvailable(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto?.getRandomValues === 'function'
  );
}

/**
 * Cryptographically unbiased float in [0, 1) using Web Crypto API.
 * Never falls back silently to Math.random() in production.
 */
export function secureRandomFloat(rng?: RandomSource): number {
  if (rng) {
    return rng();
  }
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    cryptoObj.getRandomValues(arr);
    return arr[0] / 0x100000000;
  }
  throw new SecureRandomUnavailableError();
}

/**
 * Unbiased random integer in [0, maxExclusive) using rejection sampling
 * when Web Crypto is available so there is zero modulo bias.
 * Never falls back silently to Math.random() in production.
 */
export function secureRandomInt(maxExclusive: number, rng?: RandomSource): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error(`maxExclusive must be a positive integer, got ${maxExclusive}`);
  }
  if (maxExclusive === 1) return 0;

  if (rng) {
    const val = Math.floor(rng() * maxExclusive);
    return Math.max(0, Math.min(maxExclusive - 1, val));
  }

  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const range = 0x100000000;
    const limit = range - (range % maxExclusive);
    const buf = new Uint32Array(1);
    let candidate = 0;
    do {
      cryptoObj.getRandomValues(buf);
      candidate = buf[0];
    } while (candidate >= limit);
    return candidate % maxExclusive;
  }

  throw new SecureRandomUnavailableError();
}

/**
 * Unbiased Fisher-Yates shuffle returning a new array.
 */
export function shuffleArray<T>(items: readonly T[], rng?: RandomSource): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1, rng);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Natural roll number comparator so "1", "2", "10" sort naturally rather than lexicographically.
 */
export function compareRollNumbers(aRoll: string, bRoll: string): number {
  return aRoll.trim().localeCompare(bRoll.trim(), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/**
 * Returns a new sorted array of students ordered naturally by roll number (then name).
 */
export function sortStudentsNaturally(students: readonly Student[]): Student[] {
  return [...students].sort((a, b) => {
    const cmp = compareRollNumbers(a.rollNumber, b.rollNumber);
    if (cmp !== 0) return cmp;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export interface RollParseResult {
  validStudentIds: string[];
  matchedRolls: string[];
  duplicateRolls: string[];
  unknownRolls: string[];
}

/**
 * Parses comma, space, semicolon, or newline-separated roll numbers
 * and validates them strictly against a class's active student roster.
 */
export function parseRollNumberInput(rawInput: string, activeClassStudents: readonly Student[]): RollParseResult {
  const tokens = rawInput
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const byNormalizedRoll = new Map<string, Student>();
  for (const s of activeClassStudents) {
    if (s.activeStatus !== 'active') continue;
    byNormalizedRoll.set(s.rollNumber.trim().toLowerCase(), s);
  }

  const seenStudentIds = new Set<string>();
  const validStudentIds: string[] = [];
  const matchedRolls: string[] = [];
  const duplicateRolls: string[] = [];
  const unknownRolls: string[] = [];

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    const matched = byNormalizedRoll.get(normalized);
    if (!matched) {
      unknownRolls.push(token);
      continue;
    }
    if (seenStudentIds.has(matched.id)) {
      duplicateRolls.push(matched.rollNumber);
      continue;
    }
    seenStudentIds.add(matched.id);
    validStudentIds.push(matched.id);
    matchedRolls.push(matched.rollNumber);
  }

  return {
    validStudentIds,
    matchedRolls,
    duplicateRolls,
    unknownRolls,
  };
}
