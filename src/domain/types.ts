export type CharacterPresentation = 'masculine' | 'feminine' | 'neutral' | 'random';
export type ResolvedPresentation = 'masculine' | 'feminine' | 'neutral';
export type AvatarSource = 'generated' | 'photo' | 'preset';

export type AvatarKind = 'legacy' | 'human' | 'mascot';
export type MonkSkinToneScale = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type MascotId = 'owl' | 'fox' | 'panda' | 'bot' | 'astronaut' | 'sprout';

export interface AvatarConfig {
  seed: string;
  presentation: ResolvedPresentation;
  /** Preserved for legacy v1 records or explicit teacher-selected MST shade hex. */
  skinTone: string;
  /** Additive v2 field: omitted or 'legacy' preserves pre-v2 avatars untouched. */
  avatarKind?: AvatarKind;
  /** Explicit teacher-chosen Monk Skin Tone (1..10) when avatarKind === 'human'. */
  monkSkinTone?: MonkSkinToneScale;
  /** Chosen mascot ID when avatarKind === 'mascot'. */
  mascotId?: MascotId;
  faceShape: 'oval' | 'round' | 'softSquare' | 'heart';
  hairStyle: string;
  hairColor: string;
  eyeStyle: 'bright' | 'cheerful' | 'calm' | 'curious' | 'wink' | 'glassesReady';
  eyebrowStyle: 'arch' | 'soft' | 'straight' | 'raised';
  mouthStyle: 'warmSmile' | 'bigGrin' | 'gentle' | 'openSmile' | 'whistle';
  outfitStyle: 'crewneck' | 'collar' | 'hoodie' | 'cardigan' | 'stripes' | 'overalls';
  outfitColor: string;
  accessory: 'none' | 'glasses' | 'roundGlasses' | 'headband' | 'bowtie' | 'starPin' | 'beanie';
  bgPattern: 'dots' | 'sunburst' | 'stripes' | 'waves' | 'stars' | 'plain';
  bgColor: string;
}

export interface ClassRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
  isStarterSample?: boolean;
}

export interface Student {
  id: string;
  classId: string;
  name: string;
  rollNumber: string;
  characterPresentation: CharacterPresentation;
  avatarSource: AvatarSource;
  avatarConfig: AvatarConfig;
  avatarBlobId?: string;
  /** Additive v2 baked lightweight thumbnail (256x256) blob reference. */
  thumbnailBlobId?: string;
  /** Additive v2 baked studio portrait (512x512) blob reference. */
  fullBlobId?: string;
  originalPhotoBlobId?: string;
  notes?: string;
  activeStatus: 'active' | 'archived';
  createdAt: number;
  updatedAt: number;
  isStarterSample?: boolean;
}

export interface StoredBlob {
  id: string;
  mimeType: string;
  dataUrl: string;
  /** Optional additive binary payload for memory-efficient storage & chunked V2 export. */
  blob?: Blob;
  byteSize?: number;
  createdAt: number;
}

export interface AttendanceLogEntry {
  id: string;
  studentId: string;
  type: 'marked_absent' | 'marked_present' | 'late_arrival' | 'left_early';
  timestamp: number;
  note?: string;
}

export interface ClassSession {
  id: string;
  classId: string;
  startedAt: number;
  endedAt?: number;
  status: 'active' | 'completed' | 'cancelled';
  absentStudentIds: string[];
  lateArrivalsIds: string[];
  earlyDeparturesIds?: string[];
  attendanceLog?: AttendanceLogEntry[];
  attendanceNotes?: string;
  activeActivityId?: string;
}

export type DailyAttendanceStatus = 'present' | 'absent';

export interface DailyAttendanceStudentEntry {
  studentId: string;
  name: string;
  rollNumber: string;
  status: DailyAttendanceStatus;
}

export interface DailyAttendanceRecord {
  /** Deterministic key `${classId}_${bsDate}` (e.g. `class_5_2083-08-02`) preventing duplicates */
  id: string;
  classId: string;
  className: string;
  /** Canonical Bikram Sambat date string `YYYY-MM-DD` */
  bsDate: string;
  /** Canonical Bikram Sambat year-month string `YYYY-MM` */
  bsMonthKey: string;
  bsYear: number;
  bsMonth: number;
  bsMonthName: string;
  bsDay: number;
  weekdayName: string;
  weekOfMonth: number;
  /** Corresponding Gregorian date `YYYY-MM-DD` in Nepal time */
  adDate: string;
  studentRecords: DailyAttendanceStudentEntry[];
  presentCount: number;
  absentCount: number;
  totalCount: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type ActivityType =
  | 'single_pick'
  | 'two_toss'
  | 'groups'
  | 'student_question'
  | 'lucky_picker'
  | 'mystery_reward';

export type SelectionMode = 'pure_random' | 'balanced' | 'least_recent';
export type RepeatPolicy = 'no_repeat' | 'allow_repeat';
export type FairnessScope = 'current_session' | 'recent_sessions' | 'all_history';
export type CardBackTheme = 'botanical' | 'geometric' | 'constellation' | 'terracotta';

export type DeckSlotState = 'hidden' | 'pending_reveal' | 'empty';

export interface DeckSlot {
  slotIndex: number;
  studentId: string | null;
  cardBackVariant: number;
  state: DeckSlotState;
}

export interface GeneratedGroup {
  groupNumber: number;
  name: string;
  studentIds: string[];
}

export interface QuestionAssignment {
  studentId: string;
  questionId: string;
  questionText: string;
  subject: string;
  revealed: boolean;
}

export interface ActivityRecord {
  id: string;
  sessionId: string;
  classId: string;
  type: ActivityType;
  selectionMode: SelectionMode;
  repeatPolicy: RepeatPolicy;
  fairnessScope: FairnessScope;
  status: 'in_progress' | 'completed';
  deckSlots: DeckSlot[];
  selectedStudentIds: string[];
  /** Timestamp of first-tap reveal used to enforce the 350ms settle lock & reload recovery. */
  pendingRevealedAt?: number;
  /** Independent card-back seed persisted for crash/reload recovery. */
  deckBackSeed?: string;
  groups?: GeneratedGroup[];
  questionAssignments?: QuestionAssignment[];
  dutyTitle?: string;
  rewardAssignments?: Array<{ studentId: string; rewardText: string; revealed: boolean }>;
  createdAt: number;
  completedAt?: number;
}

export interface ActivitySelection {
  id: string;
  activityId: string;
  sessionId: string;
  classId: string;
  studentId: string;
  selectionOrder: number;
  selectedAt: number;
  pairId?: string;
  groupIndex?: number;
  questionId?: string;
  questionText?: string;
  dutyTitle?: string;
  rewardText?: string;
  undoneAt?: number;
}

export interface QuestionItem {
  id: string;
  subject: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  isStarterSample?: boolean;
}

export interface RewardChallengeItem {
  id: string;
  kind: 'reward' | 'challenge' | 'duty';
  text: string;
  createdAt: number;
  isStarterSample?: boolean;
}

export interface AppSettings {
  id: 'app_settings';
  /** Canonical Warm Ivory theme; kept as a property for v1 backward compatibility. */
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  hapticsEnabled?: boolean;
  keyboardShortcutsEnabled?: boolean;
  reduceMotion: boolean;
  lowPerformanceMode: boolean;
  defaultSelectionMode: SelectionMode;
  defaultRepeatPolicy: RepeatPolicy;
  fairnessScope: FairnessScope;
  cardBackTheme: CardBackTheme;
  backupReminderDays: number;
  lastBackupAt?: number;
  lastBackupV2At?: number;
  seededSampleData?: boolean;
}
