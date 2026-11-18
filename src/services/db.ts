import Dexie, { type Table } from 'dexie';
import {
  migrateV1ActivityToV2,
  migrateV1SessionToV2,
  migrateV1SettingsToV2,
  migrateV1StudentToV2,
} from '../domain/migration';
import { buildDailyAttendanceFromSession, makeDailyAttendanceId } from '../domain/nepaliCalendar';
import type {
  ActivityRecord,
  ActivitySelection,
  AppSettings,
  ClassRecord,
  ClassSession,
  DailyAttendanceRecord,
  QuestionItem,
  RewardChallengeItem,
  StoredBlob,
  Student,
} from '../domain/types';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'app_settings',
  theme: 'light',
  soundEnabled: true,
  hapticsEnabled: true,
  keyboardShortcutsEnabled: true,
  reduceMotion: false,
  lowPerformanceMode: false,
  defaultSelectionMode: 'pure_random',
  defaultRepeatPolicy: 'no_repeat',
  fairnessScope: 'current_session',
  cardBackTheme: 'terracotta',
  backupReminderDays: 7,
  seededSampleData: false,
};

export class ClassroomRandomizerDB extends Dexie {
  classes!: Table<ClassRecord, string>;
  students!: Table<Student, string>;
  blobs!: Table<StoredBlob, string>;
  sessions!: Table<ClassSession, string>;
  activities!: Table<ActivityRecord, string>;
  selections!: Table<ActivitySelection, string>;
  questions!: Table<QuestionItem, string>;
  rewards!: Table<RewardChallengeItem, string>;
  settings!: Table<AppSettings, string>;
  dailyAttendance!: Table<DailyAttendanceRecord, string>;

  constructor() {
    super('ClassroomRandomizerDB');
    this.version(1).stores({
      classes: 'id, name, archivedAt, createdAt',
      students: 'id, classId, rollNumber, name, activeStatus, [classId+activeStatus]',
      blobs: 'id, createdAt',
      sessions: 'id, classId, status, startedAt, [classId+status]',
      activities: 'id, sessionId, classId, status, createdAt',
      selections: 'id, activityId, sessionId, classId, studentId, selectedAt, undoneAt',
      questions: 'id, subject, createdAt',
      rewards: 'id, kind, createdAt',
      settings: 'id',
    });

    this.version(2)
      .stores({
        classes: 'id, name, archivedAt, createdAt',
        students: 'id, classId, rollNumber, name, activeStatus, [classId+activeStatus]',
        blobs: 'id, createdAt',
        sessions: 'id, classId, status, startedAt, [classId+status]',
        activities: 'id, sessionId, classId, status, createdAt',
        selections: 'id, activityId, sessionId, classId, studentId, selectedAt, undoneAt',
        questions: 'id, subject, createdAt',
        rewards: 'id, kind, createdAt',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('students')
          .toCollection()
          .modify((student: Student) => {
            Object.assign(student, migrateV1StudentToV2(student));
          });

        await tx
          .table('sessions')
          .toCollection()
          .modify((session: ClassSession) => {
            Object.assign(session, migrateV1SessionToV2(session));
          });

        await tx
          .table('activities')
          .toCollection()
          .modify((activity: ActivityRecord) => {
            Object.assign(activity, migrateV1ActivityToV2(activity));
          });

        await tx
          .table('settings')
          .toCollection()
          .modify((settings: AppSettings) => {
            Object.assign(settings, migrateV1SettingsToV2(settings));
          });
      });

    this.version(3)
      .stores({
        classes: 'id, name, archivedAt, createdAt',
        students: 'id, classId, rollNumber, name, activeStatus, [classId+activeStatus]',
        blobs: 'id, createdAt',
        sessions: 'id, classId, status, startedAt, [classId+status]',
        activities: 'id, sessionId, classId, status, createdAt',
        selections: 'id, activityId, sessionId, classId, studentId, selectedAt, undoneAt',
        questions: 'id, subject, createdAt',
        rewards: 'id, kind, createdAt',
        settings: 'id',
        dailyAttendance:
          'id, &[classId+bsDate], classId, bsDate, bsMonthKey, [bsMonthKey+classId], bsYear, bsMonth, updatedAt',
      })
      .upgrade(async (tx) => {
        const [classes, students, sessions, existingRecords] = await Promise.all([
          tx.table<ClassRecord, string>('classes').toArray(),
          tx.table<Student, string>('students').toArray(),
          tx.table<ClassSession, string>('sessions').toArray(),
          tx.table<DailyAttendanceRecord, string>('dailyAttendance').toArray(),
        ]);

        const classMap = new Map(classes.map((c) => [c.id, c]));
        const byId = new Map(existingRecords.map((r) => [r.id, r]));

        const sortedSessions = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
        for (const sess of sortedSessions) {
          const cls = classMap.get(sess.classId) ?? { id: sess.classId, name: sess.classId };
          const built = buildDailyAttendanceFromSession(sess, cls, students);
          const prev = byId.get(built.id);
          if (!prev || built.updatedAt >= prev.updatedAt) {
            byId.set(built.id, prev ? { ...built, createdAt: prev.createdAt } : built);
          }
        }

        if (byId.size > 0) {
          await tx.table('dailyAttendance').bulkPut(Array.from(byId.values()));
        }
      });
  }
}

export const db = new ClassroomRandomizerDB();

export async function getDailyAttendanceRecord(
  classId: string,
  bsDate: string
): Promise<DailyAttendanceRecord | undefined> {
  return db.dailyAttendance.get(makeDailyAttendanceId(classId, bsDate));
}

export async function upsertDailyAttendanceRecord(
  record: DailyAttendanceRecord
): Promise<DailyAttendanceRecord> {
  const existing = await db.dailyAttendance.get(record.id);
  const merged: DailyAttendanceRecord = existing
    ? {
        ...record,
        createdAt: existing.createdAt,
        updatedAt: Math.max(Date.now(), record.updatedAt),
      }
    : record;
  await db.dailyAttendance.put(merged);
  return merged;
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getAppSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('app_settings');
  if (existing) {
    return {
      ...DEFAULT_APP_SETTINGS,
      ...existing,
      theme: 'light',
      hapticsEnabled: existing.hapticsEnabled ?? true,
      keyboardShortcutsEnabled: existing.keyboardShortcutsEnabled ?? true,
    };
  }
  await db.settings.put(DEFAULT_APP_SETTINGS);
  return DEFAULT_APP_SETTINGS;
}

export async function saveAppSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const next: AppSettings = {
    ...current,
    ...partial,
    id: 'app_settings',
    theme: 'light',
  };
  await db.settings.put(next);
  return next;
}

export async function saveBlobDataUrl(
  dataUrl: string,
  mimeType = 'image/webp'
): Promise<string> {
  const id = createId('blob');
  await db.blobs.put({
    id,
    mimeType,
    dataUrl,
    byteSize: dataUrl.length,
    createdAt: Date.now(),
  });
  return id;
}

export async function getBlobDataUrl(blobId?: string): Promise<string | null> {
  if (!blobId) return null;
  const record = await db.blobs.get(blobId);
  return record?.dataUrl ?? null;
}

export async function deleteBlobById(blobId?: string): Promise<void> {
  if (!blobId) return;
  await db.blobs.delete(blobId);
}

export async function requestPersistentStorage(): Promise<{ supported: boolean; persisted: boolean }> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return { supported: false, persisted: false };
  }
  try {
    const persisted = await navigator.storage.persist();
    return { supported: true, persisted };
  } catch {
    return { supported: true, persisted: false };
  }
}

export async function checkPersistentStorage(): Promise<{
  supported: boolean;
  persisted: boolean;
  estimate?: { usage?: number; quota?: number };
}> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return { supported: false, persisted: false };
  }
  try {
    const persisted = await navigator.storage.persisted();
    const estimate = navigator.storage.estimate ? await navigator.storage.estimate() : undefined;
    return { supported: true, persisted, estimate };
  } catch {
    return { supported: true, persisted: false };
  }
}
