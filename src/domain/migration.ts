import type {
  ActivityRecord,
  AppSettings,
  AvatarConfig,
  ClassSession,
  Student,
} from './types';

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Migrates a v1 Student record safely to v2 defaults without modifying IDs,
 * roll numbers, blob references, or silently altering existing legacy avatar tones.
 */
export function migrateV1StudentToV2(student: Student): Student {
  const cfg: AvatarConfig = student.avatarConfig;
  const normalizedConfig: AvatarConfig = {
    ...cfg,
    avatarKind: cfg.avatarKind ?? 'legacy',
  };

  return {
    ...student,
    avatarConfig: normalizedConfig,
    thumbnailBlobId: student.thumbnailBlobId ?? student.avatarBlobId,
    fullBlobId: student.fullBlobId ?? student.avatarBlobId,
  };
}

/**
 * Migrates a v1 ClassSession safely to v2 with additive attendance log & early departure arrays.
 */
export function migrateV1SessionToV2(session: ClassSession): ClassSession {
  return {
    ...session,
    earlyDeparturesIds: session.earlyDeparturesIds ?? [],
    attendanceLog: session.attendanceLog ?? [],
  };
}

/**
 * Migrates a v1 ActivityRecord safely to v2 with deterministic fallback deckBackSeed.
 */
export function migrateV1ActivityToV2(activity: ActivityRecord): ActivityRecord {
  return {
    ...activity,
    deckBackSeed: activity.deckBackSeed ?? activity.id,
  };
}

/**
 * Migrates v1 AppSettings to v2 canonical Warm Ivory theme and additive toggles
 * while preserving user sound, motion, performance, fairness, and card-back preferences.
 */
export function migrateV1SettingsToV2(settings: AppSettings): AppSettings {
  return {
    ...settings,
    id: 'app_settings',
    theme: 'light',
    hapticsEnabled: settings.hapticsEnabled ?? true,
    keyboardShortcutsEnabled: settings.keyboardShortcutsEnabled ?? true,
  };
}

export interface MigrationCountSnapshot {
  classes: number;
  students: number;
  blobs: number;
  sessions: number;
  activities: number;
  selections: number;
  questions: number;
  rewards: number;
  settings: number;
}

export function verifyMigrationIntegrity(
  before: MigrationCountSnapshot,
  after: MigrationCountSnapshot
): { ok: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  (Object.keys(before) as Array<keyof MigrationCountSnapshot>).forEach((table) => {
    if (after[table] < before[table]) {
      mismatches.push(`${table}: expected >= ${before[table]}, got ${after[table]}`);
    }
  });
  return {
    ok: mismatches.length === 0,
    mismatches,
  };
}
