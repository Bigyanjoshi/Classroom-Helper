import test from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateV1ActivityToV2,
  migrateV1SessionToV2,
  migrateV1SettingsToV2,
  migrateV1StudentToV2,
  verifyMigrationIntegrity,
} from './migration';
import { UNIFORM_CARTOON_TONE } from './avatarGenerator';
import type { ActivityRecord, AppSettings, ClassSession, Student } from './types';

test('v1 -> v2 migration preserves IDs, roll numbers, blob IDs, legacy skin tones, and user preferences', () => {
  const v1Student: Student = {
    id: 'stu_legacy_1',
    classId: 'class_5',
    name: 'Ananya Rao',
    rollNumber: '12',
    characterPresentation: 'feminine',
    avatarSource: 'photo',
    avatarBlobId: 'blob_photo_1',
    originalPhotoBlobId: 'blob_orig_1',
    avatarConfig: {
      seed: 'seed-1',
      presentation: 'feminine',
      skinTone: UNIFORM_CARTOON_TONE,
      faceShape: 'oval',
      hairStyle: 'bobCut',
      hairColor: '#231F20',
      eyeStyle: 'bright',
      eyebrowStyle: 'arch',
      mouthStyle: 'warmSmile',
      outfitStyle: 'collar',
      outfitColor: '#D96B27',
      accessory: 'none',
      bgPattern: 'dots',
      bgColor: '#F9E5D8',
    },
    activeStatus: 'active',
    createdAt: 1000,
    updatedAt: 1000,
  };

  const migratedStu = migrateV1StudentToV2(v1Student);
  assert.equal(migratedStu.id, 'stu_legacy_1');
  assert.equal(migratedStu.rollNumber, '12');
  assert.equal(migratedStu.avatarBlobId, 'blob_photo_1');
  assert.equal(migratedStu.thumbnailBlobId, 'blob_photo_1');
  assert.equal(migratedStu.fullBlobId, 'blob_photo_1');
  assert.equal(migratedStu.originalPhotoBlobId, 'blob_orig_1');
  assert.equal(migratedStu.avatarConfig.avatarKind, 'legacy');
  assert.equal(migratedStu.avatarConfig.skinTone, UNIFORM_CARTOON_TONE);

  const v1Session: ClassSession = {
    id: 'sess_1',
    classId: 'class_5',
    startedAt: 2000,
    status: 'active',
    absentStudentIds: ['stu_2'],
    lateArrivalsIds: [],
  };
  const migratedSess = migrateV1SessionToV2(v1Session);
  assert.deepEqual(migratedSess.earlyDeparturesIds, []);
  assert.deepEqual(migratedSess.attendanceLog, []);

  const v1Activity: ActivityRecord = {
    id: 'act_1',
    sessionId: 'sess_1',
    classId: 'class_5',
    type: 'single_pick',
    selectionMode: 'balanced',
    repeatPolicy: 'no_repeat',
    fairnessScope: 'recent_sessions',
    status: 'in_progress',
    deckSlots: [{ slotIndex: 0, studentId: 'stu_legacy_1', cardBackVariant: 2, state: 'hidden' }],
    selectedStudentIds: [],
    createdAt: 3000,
  };
  const migratedAct = migrateV1ActivityToV2(v1Activity);
  assert.equal(migratedAct.deckBackSeed, 'act_1');

  const v1Settings: AppSettings = {
    id: 'app_settings',
    theme: 'dark',
    soundEnabled: false,
    reduceMotion: true,
    lowPerformanceMode: true,
    defaultSelectionMode: 'balanced',
    defaultRepeatPolicy: 'allow_repeat',
    fairnessScope: 'all_history',
    cardBackTheme: 'botanical',
    backupReminderDays: 14,
    seededSampleData: true,
  };
  const migratedSettings = migrateV1SettingsToV2(v1Settings);
  assert.equal(migratedSettings.theme, 'light');
  assert.equal(migratedSettings.soundEnabled, false);
  assert.equal(migratedSettings.reduceMotion, true);
  assert.equal(migratedSettings.defaultSelectionMode, 'balanced');
  assert.equal(migratedSettings.hapticsEnabled, true);
  assert.equal(migratedSettings.keyboardShortcutsEnabled, true);

  const countOk = verifyMigrationIntegrity(
    { classes: 3, students: 20, blobs: 2, sessions: 4, activities: 5, selections: 12, questions: 8, rewards: 6, settings: 1 },
    { classes: 3, students: 20, blobs: 2, sessions: 4, activities: 5, selections: 12, questions: 8, rewards: 6, settings: 1 }
  );
  assert.equal(countOk.ok, true);

  const countDrop = verifyMigrationIntegrity(
    { classes: 3, students: 20, blobs: 2, sessions: 4, activities: 5, selections: 12, questions: 8, rewards: 6, settings: 1 },
    { classes: 3, students: 19, blobs: 2, sessions: 4, activities: 5, selections: 12, questions: 8, rewards: 6, settings: 1 }
  );
  assert.equal(countDrop.ok, false);
});
