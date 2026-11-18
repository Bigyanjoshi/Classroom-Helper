import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Download,
  History,
  Home,
  Menu,
  Settings,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import {
  detectStudentGenderFromName,
  pickUniqueAvatarConfig,
  reconcileStudent3DCharacter,
} from './domain/avatarGenerator';
import type { ClasspackPayload } from './domain/cryptoBackup';
import { normalizeClassLabel, type ParsedStudentRow } from './domain/csvParser';
import {
  computeFairnessWeights,
  createDeckSlots,
  filterHistoryByScope,
  getEligibleStudents,
} from './domain/eligibility';
import {
  buildDailyAttendanceFromSession,
  buildDailyAttendanceRecord,
  getTodayNepaliDate,
  parseBsDateString,
  reconcileDailyAttendanceRecordWithBsTable,
} from './domain/nepaliCalendar';
import type {
  ActivityRecord,
  ActivitySelection,
  ActivityType,
  AppSettings,
  AttendanceLogEntry,
  AvatarConfig,
  CardBackTheme,
  CharacterPresentation,
  ClassRecord,
  ClassSession,
  DailyAttendanceRecord,
  GeneratedGroup,
  QuestionItem,
  RepeatPolicy,
  RewardChallengeItem,
  SelectionMode,
  Student,
} from './domain/types';
import {
  createId,
  db,
  DEFAULT_APP_SETTINGS,
  deleteBlobById,
  getAppSettings,
  saveAppSettings,
  saveBlobDataUrl,
  upsertDailyAttendanceRecord,
} from './services/db';
import { useOnlineStatus, usePWAInstall } from './services/pwaHook';
import { ensureInitialDatabaseSeeded } from './services/seedService';

import {
  ImportStudentsModal,
  type ImportDuplicateAction,
} from './components/ImportStudentsModal';
import { PhotoUploadModal } from './components/PhotoUploadModal';
import { StudentFormModal } from './components/StudentFormModal';

import { ActivityCenterPage } from './pages/ActivityCenterPage';
import { AttendancePage, type AttendanceViewTab } from './pages/AttendancePage';
import { ClassOverviewPage, ClassesPage } from './pages/ClassesAndOverviewPage';
import { DashboardPage } from './pages/DashboardPage';
import { DecksHistoryHubPage, type DecksHistoryTab } from './pages/DecksHistoryHubPage';
import { GroupGeneratorPage } from './pages/GroupGeneratorPage';
import { MysteryDeckPage } from './pages/MysteryDeckPage';
import { RosterStudioHubPage, type RosterStudioTab } from './pages/RosterStudioHubPage';
import { SettingsBackupPage } from './pages/SettingsBackupPage';
import type { BulkStudentUpdateItem } from './pages/StudentsPage';

type RouteView =
  | { name: 'dashboard' }
  | { name: 'classes' }
  | { name: 'class_overview'; classId: string }
  | {
      name: 'attendance';
      classId: string;
      mode: 'new_session' | 'edit_session';
      sessionId?: string;
      tab?: AttendanceViewTab;
      bsDate?: string;
    }
  | { name: 'roster_studio'; tab: RosterStudioTab }
  | { name: 'activity_center'; classId: string; sessionId: string }
  | {
      name: 'mystery_deck';
      classId: string;
      sessionId: string;
      activityId: string;
      questionSubject?: string;
    }
  | { name: 'group_generator'; classId: string; sessionId: string }
  | { name: 'decks_history'; tab: DecksHistoryTab }
  | { name: 'settings' };

type HubId = 'classes_hub' | 'roster_hub' | 'decks_hub' | 'settings_hub';

const ROUTE_STORAGE_KEY = 'classroom_randomizer_last_route_v2';

function detectMimeFromDataUrl(dataUrl: string, fallback = 'image/webp'): string {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match?.[1] || fallback;
}

function getActiveHub(route: RouteView): HubId {
  switch (route.name) {
    case 'roster_studio':
      return 'roster_hub';
    case 'decks_history':
      return 'decks_hub';
    case 'settings':
      return 'settings_hub';
    default:
      return 'classes_hub';
  }
}

export default function App() {
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  const [ready, setReady] = useState(false);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendanceRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [selections, setSelections] = useState<ActivitySelection[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [rewards, setRewards] = useState<RewardChallengeItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  const [historyStack, setHistoryStack] = useState<RouteView[]>([{ name: 'dashboard' }]);
  const currentRoute = historyStack[historyStack.length - 1];

  const [activeClassId, setActiveClassId] = useState<string>('class_5');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Modals
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoTargetStudent, setPhotoTargetStudent] = useState<Student | null>(null);

  const reloadAllFromDb = useCallback(async () => {
    const [cls, rawStu, sess, rawDailyAtt, act, sel, q, rew, set] = await Promise.all([
      db.classes.toArray(),
      db.students.toArray(),
      db.sessions.toArray(),
      db.dailyAttendance.toArray(),
      db.activities.toArray(),
      db.selections.toArray(),
      db.questions.toArray(),
      db.rewards.toArray(),
      getAppSettings(),
    ]);

    // Upgrade any legacy mascot/starter student records to harmonious 3D Student Characters
    // with automatic gender-matched boy/girl 3D features.
    const stu: Student[] = [];
    const upgradedStudents: Student[] = [];
    const classConfigsMap = new Map<string, AvatarConfig[]>();
    for (const s of rawStu) {
      const existingConfigs = classConfigsMap.get(s.classId) ?? [];
      const { student: reconciledStu, changed } = reconcileStudent3DCharacter(s, existingConfigs);
      existingConfigs.push(reconciledStu.avatarConfig);
      classConfigsMap.set(s.classId, existingConfigs);
      stu.push(reconciledStu);
      if (changed) {
        upgradedStudents.push(reconciledStu);
      }
    }
    if (upgradedStudents.length > 0) {
      await db.students.bulkPut(upgradedStudents);
    }

    // Reconcile any existing dailyAttendance records whose adDate maps to an updated BS date
    const staleIdsToDelete: string[] = [];
    const repairedToPut: DailyAttendanceRecord[] = [];
    const reconciledById = new Map<string, DailyAttendanceRecord>();
    for (const item of rawDailyAtt) {
      const { record: reconciled, changed } = reconcileDailyAttendanceRecordWithBsTable(item);
      if (changed) {
        if (item.id !== reconciled.id) {
          staleIdsToDelete.push(item.id);
        }
        repairedToPut.push(reconciled);
      }
      const existing = reconciledById.get(reconciled.id);
      if (!existing || reconciled.updatedAt >= existing.updatedAt) {
        reconciledById.set(reconciled.id, reconciled);
      }
    }
    if (staleIdsToDelete.length > 0) {
      await db.dailyAttendance.bulkDelete(staleIdsToDelete);
    }
    if (repairedToPut.length > 0) {
      await db.dailyAttendance.bulkPut(Array.from(reconciledById.values()));
    }
    const dailyAtt = Array.from(reconciledById.values());

    // Backfill any sessions that are not yet represented in dailyAttendance
    const existingKeys = new Set(dailyAtt.map((r) => `${r.classId}_${r.bsDate}`));
    const sortedSessions = [...sess].sort((a, b) => b.startedAt - a.startedAt);
    const backfilled: DailyAttendanceRecord[] = [];
    for (const s of sortedSessions) {
      const c = cls.find((item) => item.id === s.classId);
      if (!c) continue;
      const rec = buildDailyAttendanceFromSession(s, c, stu);
      const key = `${rec.classId}_${rec.bsDate}`;
      if (!existingKeys.has(key)) {
        existingKeys.add(key);
        backfilled.push(rec);
      }
    }
    if (backfilled.length > 0) {
      await db.dailyAttendance.bulkPut(backfilled);
    }

    const allDailyAtt = backfilled.length > 0 ? [...dailyAtt, ...backfilled] : dailyAtt;

    setClasses(cls);
    setStudents(stu);
    setSessions(sess);
    setDailyAttendance(allDailyAtt);
    setActivities(act);
    setSelections(sel);
    setQuestions(q);
    setRewards(rew);
    setSettings(set);
    return { cls, stu, sess, dailyAtt: allDailyAtt, act };
  }, []);

  useEffect(() => {
    (async () => {
      await ensureInitialDatabaseSeeded();
      const { cls, sess, act } = await reloadAllFromDb();
      const firstActive = cls.find((c) => !c.archivedAt);
      if (firstActive) {
        setActiveClassId(firstActive.id);
      }

      // Safe session/route restoration across page refresh
      try {
        const savedRaw = localStorage.getItem(ROUTE_STORAGE_KEY);
        if (savedRaw) {
          const parsed = JSON.parse(savedRaw) as RouteView;
          if (parsed && typeof parsed.name === 'string') {
            if (parsed.name === 'mystery_deck') {
              const sExists = sess.some((s) => s.id === parsed.sessionId && s.status === 'active');
              const aExists = act.some((a) => a.id === parsed.activityId);
              if (sExists && aExists) {
                setHistoryStack([{ name: 'dashboard' }, parsed]);
                setActiveClassId(parsed.classId);
              }
            } else if (parsed.name === 'activity_center' || parsed.name === 'group_generator') {
              const sExists = sess.some((s) => s.id === parsed.sessionId && s.status === 'active');
              if (sExists) {
                setHistoryStack([{ name: 'dashboard' }, parsed]);
                setActiveClassId(parsed.classId);
              }
            } else if (
              parsed.name === 'attendance' ||
              parsed.name === 'roster_studio' ||
              parsed.name === 'decks_history' ||
              parsed.name === 'settings' ||
              parsed.name === 'classes' ||
              parsed.name === 'class_overview'
            ) {
              setHistoryStack([{ name: 'dashboard' }, parsed]);
            }
          }
        }
      } catch {
        // Ignore invalid persisted route
      }
      setReady(true);
    })();
  }, [reloadAllFromDb]);

  // Ensure canonical Warm Ivory theme & apply reduceMotion accessibility class
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    if (settings.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
  }, [settings.reduceMotion]);

  // Persist current route for seamless refresh/reload recovery
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(currentRoute));
    } catch {
      // Ignore storage quota issues
    }
  }, [ready, currentRoute]);

  const navigateTo = useCallback((next: RouteView) => {
    setMobileNavOpen(false);
    setHistoryStack((prev) => {
      const top = prev[prev.length - 1];
      if (JSON.stringify(top) === JSON.stringify(next)) return prev;
      window.history.pushState({ routeIndex: prev.length }, '');
      return [...prev, next];
    });
  }, []);

  const replaceTopRoute = useCallback((next: RouteView) => {
    setHistoryStack((prev) => {
      if (prev.length === 0) return [next];
      return [...prev.slice(0, -1), next];
    });
  }, []);

  const goBack = useCallback(() => {
    setHistoryStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  // Support browser back button consistently
  useEffect(() => {
    const onPopState = () => {
      setHistoryStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const activeClasses = useMemo(() => classes.filter((c) => !c.archivedAt), [classes]);

  const handleGlobalClassSelect = (classId: string) => {
    setActiveClassId(classId);
    if (classFilter !== 'all') {
      setClassFilter(classId);
    }
    if (currentRoute.name === 'attendance') {
      const sessForClass = sessions.find(
        (s) => s.classId === classId && s.status === 'active'
      );
      replaceTopRoute({
        ...currentRoute,
        classId,
        mode: sessForClass ? 'edit_session' : 'new_session',
        sessionId: sessForClass?.id,
      });
    } else if (currentRoute.name === 'class_overview') {
      replaceTopRoute({ name: 'class_overview', classId });
    } else if (currentRoute.name === 'activity_center' || currentRoute.name === 'group_generator') {
      handleStartSession(classId);
    }
  };

  const handleQuickLaunchActivity = async (classId: string, type: ActivityType) => {
    setActiveClassId(classId);
    if (classFilter !== 'all') {
      setClassFilter(classId);
    }

    let activeSess = sessions.find((s) => s.classId === classId && s.status === 'active');
    if (!activeSess) {
      const now = Date.now();
      const todayBs = getTodayNepaliDate(now).bsDateString;
      const todayRec = dailyAttendance.find(
        (r) => r.classId === classId && r.bsDate === todayBs
      );
      const absentIds = todayRec
        ? todayRec.studentRecords.filter((sr) => sr.status === 'absent').map((sr) => sr.studentId)
        : [];
      const newSession: ClassSession = {
        id: createId('sess'),
        classId,
        startedAt: now,
        status: 'active',
        absentStudentIds: absentIds,
        lateArrivalsIds: [],
        earlyDeparturesIds: [],
        attendanceLog: [],
        attendanceNotes: todayRec?.notes,
      };
      await db.sessions.put(newSession);
      activeSess = newSession;
    }

    if (type === 'groups') {
      await reloadAllFromDb();
      navigateTo({ name: 'group_generator', classId, sessionId: activeSess.id });
      return;
    }

    const eligible = getEligibleStudents({
      students,
      session: activeSess,
      alreadySelectedIds: [],
      repeatPolicy: type === 'two_toss' ? 'no_repeat' : settings.defaultRepeatPolicy,
    });

    if (eligible.length === 0) {
      await reloadAllFromDb();
      navigateTo({
        name: 'attendance',
        classId,
        mode: 'edit_session',
        sessionId: activeSess.id,
        tab: 'daily_register',
      });
      return;
    }

    const recentIds = sessions
      .filter((s) => s.classId === classId && s.id !== activeSess!.id)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 5)
      .map((s) => s.id);

    const scopedHistory = filterHistoryByScope(
      selections,
      classId,
      settings.fairnessScope,
      activeSess.id,
      recentIds
    );
    const weights = computeFairnessWeights(eligible, scopedHistory, settings.defaultSelectionMode);
    const deckSlots = createDeckSlots(eligible, settings.defaultSelectionMode, weights);

    const newAct: ActivityRecord = {
      id: createId('act'),
      sessionId: activeSess.id,
      classId,
      type,
      selectionMode: settings.defaultSelectionMode,
      repeatPolicy: type === 'two_toss' ? 'no_repeat' : settings.defaultRepeatPolicy,
      fairnessScope: settings.fairnessScope,
      status: 'in_progress',
      deckSlots,
      selectedStudentIds: [],
      dutyTitle: type === 'lucky_picker' ? 'Classroom Helper' : undefined,
      deckBackSeed: createId('seed'),
      createdAt: Date.now(),
    };

    await db.activities.put(newAct);
    await db.sessions.update(activeSess.id, { activeActivityId: newAct.id });
    await reloadAllFromDb();

    navigateTo({
      name: 'mystery_deck',
      classId,
      sessionId: activeSess.id,
      activityId: newAct.id,
      questionSubject: 'all',
    });
  };

  const handleStartSession = (classId: string) => {
    setActiveClassId(classId);
    const activeSess = sessions.find((s) => s.classId === classId && s.status === 'active');
    navigateTo({
      name: 'attendance',
      classId,
      mode: activeSess ? 'edit_session' : 'new_session',
      sessionId: activeSess?.id,
      tab: 'daily_register',
    });
  };

  const handleOpenAttendance = (classId: string, tab: AttendanceViewTab = 'daily_register') => {
    setActiveClassId(classId);
    const activeSess = sessions.find((s) => s.classId === classId && s.status === 'active');
    navigateTo({
      name: 'attendance',
      classId,
      mode: activeSess ? 'edit_session' : 'new_session',
      sessionId: activeSess?.id,
      tab,
    });
  };

  const handleResumeSession = (classId: string) => {
    setActiveClassId(classId);
    const activeSess = sessions.find((s) => s.classId === classId && s.status === 'active');
    if (!activeSess) {
      void handleQuickLaunchActivity(classId, 'single_pick');
      return;
    }
    const inProgressAct = activities.find(
      (a) => a.sessionId === activeSess.id && a.status === 'in_progress'
    );
    if (inProgressAct && inProgressAct.type !== 'groups') {
      navigateTo({
        name: 'mystery_deck',
        classId,
        sessionId: activeSess.id,
        activityId: inProgressAct.id,
      });
    } else {
      navigateTo({
        name: 'activity_center',
        classId,
        sessionId: activeSess.id,
      });
    }
  };

  const handleAutoSaveDailyAttendance = useCallback(
    async (record: DailyAttendanceRecord) => {
      await upsertDailyAttendanceRecord(record);

      // If this record is for today's BS date and there is an active session for this class,
      // keep the active session's absentStudentIds synchronized.
      const todayBs = getTodayNepaliDate().bsDateString;
      if (record.bsDate === todayBs) {
        const activeSess = sessions.find(
          (s) => s.classId === record.classId && s.status === 'active'
        );
        if (activeSess) {
          const nextAbsentIds = record.studentRecords
            .filter((sr) => sr.status === 'absent')
            .map((sr) => sr.studentId);
          await db.sessions.update(activeSess.id, {
            absentStudentIds: nextAbsentIds,
            attendanceNotes: record.notes ?? activeSess.attendanceNotes,
          });
        }
      }

      await reloadAllFromDb();
    },
    [sessions, reloadAllFromDb]
  );

  const handleConfirmAttendance = async (
    classId: string,
    mode: 'new_session' | 'edit_session',
    existingSessionId: string | undefined,
    absentIds: string[],
    notes: string,
    bsDateString?: string
  ) => {
    const now = Date.now();
    const cls = classes.find((c) => c.id === classId);
    const bsInfo =
      (bsDateString ? parseBsDateString(bsDateString) : null) ?? getTodayNepaliDate(now);

    if (cls) {
      const existingDailyRecord = dailyAttendance.find(
        (r) => r.classId === classId && r.bsDate === bsInfo.bsDateString
      );
      const classRoster = students.filter(
        (s) => s.classId === classId && s.activeStatus === 'active'
      );
      const dailyRec = buildDailyAttendanceRecord({
        classRecord: cls,
        students: classRoster,
        absentStudentIds: absentIds,
        bsDateInfo: bsInfo,
        notes,
        existingRecord: existingDailyRecord,
        now,
      });
      await upsertDailyAttendanceRecord(dailyRec);
    }

    const activeSessForClass =
      (existingSessionId ? sessions.find((s) => s.id === existingSessionId) : undefined) ??
      sessions.find((s) => s.classId === classId && s.status === 'active');

    if (mode === 'edit_session' && activeSessForClass) {
      const prevAbsent = new Set(activeSessForClass.absentStudentIds);
      const nextAbsent = new Set(absentIds);

      const latePresent = activeSessForClass.absentStudentIds.filter((id) => !nextAbsent.has(id));
      const leftEarly = absentIds.filter((id) => !prevAbsent.has(id));

      const newLogEntries: AttendanceLogEntry[] = [
        ...latePresent.map((studentId) => ({
          id: createId('attlog'),
          studentId,
          type: 'late_arrival' as const,
          timestamp: now,
        })),
        ...leftEarly.map((studentId) => ({
          id: createId('attlog'),
          studentId,
          type: 'left_early' as const,
          timestamp: now,
        })),
      ];

      const updated: ClassSession = {
        ...activeSessForClass,
        absentStudentIds: absentIds,
        lateArrivalsIds: Array.from(
          new Set([...(activeSessForClass.lateArrivalsIds ?? []), ...latePresent])
        ),
        earlyDeparturesIds: Array.from(
          new Set([...(activeSessForClass.earlyDeparturesIds ?? []), ...leftEarly])
        ),
        attendanceLog: [...(activeSessForClass.attendanceLog ?? []), ...newLogEntries],
        attendanceNotes: notes || activeSessForClass.attendanceNotes,
      };
      await db.sessions.put(updated);
      await reloadAllFromDb();
      navigateTo({ name: 'activity_center', classId, sessionId: updated.id });
      return;
    }

    // Complete any old active sessions for this class without deleting their history
    const oldActives = sessions.filter((s) => s.classId === classId && s.status === 'active');
    for (const old of oldActives) {
      await db.sessions.put({ ...old, status: 'completed', endedAt: now });
    }

    // Create or update session for this class
    const newSession: ClassSession = {
      id: createId('sess'),
      classId,
      startedAt: now,
      status: 'active',
      absentStudentIds: absentIds,
      lateArrivalsIds: [],
      earlyDeparturesIds: [],
      attendanceLog: [],
      attendanceNotes: notes || undefined,
    };
    await db.sessions.put(newSession);
    await reloadAllFromDb();
    navigateTo({ name: 'activity_center', classId, sessionId: newSession.id });
  };

  const handleLaunchActivity = async (
    classId: string,
    sessionId: string,
    cfg: {
      type: ActivityType;
      selectionMode: SelectionMode;
      repeatPolicy: RepeatPolicy;
      questionSubject?: string;
      dutyTitle?: string;
    }
  ) => {
    if (cfg.type === 'groups') {
      navigateTo({ name: 'group_generator', classId, sessionId });
      return;
    }

    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const eligible = getEligibleStudents({
      students,
      session,
      alreadySelectedIds: [],
      repeatPolicy: cfg.repeatPolicy,
    });

    const recentIds = sessions
      .filter((s) => s.classId === classId && s.id !== sessionId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 5)
      .map((s) => s.id);

    const scopedHistory = filterHistoryByScope(
      selections,
      classId,
      settings.fairnessScope,
      sessionId,
      recentIds
    );
    const weights = computeFairnessWeights(eligible, scopedHistory, cfg.selectionMode);
    const deckSlots = createDeckSlots(eligible, cfg.selectionMode, weights);

    const newAct: ActivityRecord = {
      id: createId('act'),
      sessionId,
      classId,
      type: cfg.type,
      selectionMode: cfg.selectionMode,
      repeatPolicy: cfg.repeatPolicy,
      fairnessScope: settings.fairnessScope,
      status: 'in_progress',
      deckSlots,
      selectedStudentIds: [],
      dutyTitle: cfg.dutyTitle,
      deckBackSeed: createId('seed'),
      createdAt: Date.now(),
    };

    await db.activities.put(newAct);
    await db.sessions.update(sessionId, { activeActivityId: newAct.id });
    await reloadAllFromDb();

    navigateTo({
      name: 'mystery_deck',
      classId,
      sessionId,
      activityId: newAct.id,
      questionSubject: cfg.questionSubject,
    });
  };

  const handleSaveStudent = async (data: {
    id?: string;
    classId: string;
    name: string;
    rollNumber: string;
    characterPresentation: CharacterPresentation;
    avatarConfig: AvatarConfig;
    notes: string;
  }) => {
    const now = Date.now();
    if (data.id) {
      const existing = students.find((s) => s.id === data.id);
      if (!existing) return;
      await db.students.put({
        ...existing,
        classId: data.classId,
        name: data.name,
        rollNumber: data.rollNumber,
        characterPresentation: data.characterPresentation,
        avatarConfig: data.avatarConfig,
        notes: data.notes || undefined,
        updatedAt: now,
      });
    } else {
      await db.students.put({
        id: createId('stu'),
        classId: data.classId,
        name: data.name,
        rollNumber: data.rollNumber,
        characterPresentation: data.characterPresentation,
        avatarSource: 'generated',
        avatarConfig: data.avatarConfig,
        notes: data.notes || undefined,
        activeStatus: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }
    await reloadAllFromDb();
  };

  const handleImportStudentsConfirm = async (
    targetClassId: string,
    rows: ParsedStudentRow[],
    duplicateAction: ImportDuplicateAction = 'update',
    useFileClasses = true
  ) => {
    const now = Date.now();
    const currentClasses = [...classes];
    const classIdByNameKey = new Map<string, string>();
    for (const c of currentClasses) {
      classIdByNameKey.set(c.name.trim().toLowerCase(), c.id);
    }

    let createdClasses = 0;
    const ensureClassIdForRow = async (row: ParsedStudentRow): Promise<string> => {
      if (!useFileClasses || !row.className) {
        return targetClassId || currentClasses[0]?.id || 'class_5';
      }
      if (row.resolvedClassId && currentClasses.some((c) => c.id === row.resolvedClassId)) {
        return row.resolvedClassId;
      }
      const { className, matchedClassId } = normalizeClassLabel(
        row.className,
        currentClasses
      );
      if (matchedClassId) return matchedClassId;

      const key = className.trim().toLowerCase();
      const cached = classIdByNameKey.get(key);
      if (cached) return cached;

      const newClassId = createId('cls');
      const newClassRecord: ClassRecord = {
        id: newClassId,
        name: className,
        createdAt: now + createdClasses,
        updatedAt: now + createdClasses,
      };
      await db.classes.put(newClassRecord);
      currentClasses.push(newClassRecord);
      classIdByNameKey.set(key, newClassId);
      createdClasses++;
      return newClassId;
    };

    // Map each actionable row to its resolved classId
    const resolvedRows: Array<{ row: ParsedStudentRow; classId: string }> = [];
    const touchedClassIds = new Set<string>();
    for (const row of rows) {
      if (row.status === 'invalid') continue;
      const cid = await ensureClassIdForRow(row);
      resolvedRows.push({ row, classId: cid });
      touchedClassIds.add(cid);
    }

    let workingStudents = [...students];

    // If replace_class is chosen, remove existing students in the classes being imported
    if (duplicateAction === 'replace_class' && touchedClassIds.size > 0) {
      const toRemove = workingStudents.filter((s) => touchedClassIds.has(s.classId));
      const removeIds = toRemove.map((s) => s.id);
      if (removeIds.length > 0) {
        await db.students.bulkDelete(removeIds);
        workingStudents = workingStudents.filter((s) => !touchedClassIds.has(s.classId));
      }
    }

    const classConfigsByClassId = new Map<string, AvatarConfig[]>();
    const usedRollsByClassId = new Map<string, Set<string>>();
    for (const s of workingStudents) {
      const cfgs = classConfigsByClassId.get(s.classId) ?? [];
      cfgs.push(s.avatarConfig);
      classConfigsByClassId.set(s.classId, cfgs);

      if (s.activeStatus === 'active') {
        const rollSet = usedRollsByClassId.get(s.classId) ?? new Set<string>();
        rollSet.add(s.rollNumber.trim().toLowerCase());
        usedRollsByClassId.set(s.classId, rollSet);
      }
    }

    const findNextFreeRoll = (cid: string, baseRoll: string): string => {
      const used = usedRollsByClassId.get(cid) ?? new Set<string>();
      if (!used.has(baseRoll.trim().toLowerCase())) {
        return baseRoll.trim();
      }
      const numericBase = parseInt(baseRoll.trim(), 10);
      let candidate = !Number.isNaN(numericBase) && numericBase > 0 ? numericBase + 1 : 1;
      while (used.has(String(candidate).toLowerCase())) {
        candidate++;
      }
      return String(candidate);
    };

    let imported = 0;
    let updated = 0;
    let skipped = rows.filter((r) => r.status === 'invalid').length;

    const toPut: Student[] = [];

    for (const { row, classId: cid } of resolvedRows) {
      const classConfigs = classConfigsByClassId.get(cid) ?? [];
      classConfigsByClassId.set(cid, classConfigs);
      const usedRolls = usedRollsByClassId.get(cid) ?? new Set<string>();
      usedRollsByClassId.set(cid, usedRolls);

      const resolvedGender =
        row.characterPresentation === 'random'
          ? detectStudentGenderFromName(row.name)
          : row.characterPresentation;

      const existingInClass = workingStudents.find(
        (s) =>
          s.classId === cid &&
          s.activeStatus === 'active' &&
          s.rollNumber.trim().toLowerCase() === row.rollNumber.trim().toLowerCase()
      );

      if (existingInClass && duplicateAction !== 'replace_class') {
        if (duplicateAction === 'skip') {
          skipped++;
          continue;
        }
        // duplicateAction === 'update': update existing student if same roll in DB,
        // or if it's a duplicate roll within the same CSV file, assign a new roll number so both students are imported!
        if (row.status === 'duplicate_in_class') {
          const cfg = pickUniqueAvatarConfig(resolvedGender, classConfigs, undefined, {
            avatarKind: 'human',
            studentName: row.name,
          });
          classConfigs.push(cfg);
          const updatedStu: Student = {
            ...existingInClass,
            name: row.name,
            characterPresentation: resolvedGender,
            avatarConfig:
              existingInClass.avatarSource === 'photo'
                ? existingInClass.avatarConfig
                : cfg,
            notes: row.notes || existingInClass.notes,
            isStarterSample: false,
            updatedAt: now + updated,
          };
          toPut.push(updatedStu);
          updated++;
          continue;
        }
      }

      if (row.status === 'duplicate_in_file' && duplicateAction === 'skip') {
        skipped++;
        continue;
      }

      const finalRoll = findNextFreeRoll(cid, row.rollNumber);
      usedRolls.add(finalRoll.toLowerCase());

      const cfg = pickUniqueAvatarConfig(resolvedGender, classConfigs, undefined, {
        avatarKind: 'human',
        studentName: row.name,
      });
      classConfigs.push(cfg);

      const newStu: Student = {
        id: createId('stu'),
        classId: cid,
        name: row.name,
        rollNumber: finalRoll,
        characterPresentation: resolvedGender,
        avatarSource: 'generated',
        avatarConfig: cfg,
        notes: row.notes || undefined,
        activeStatus: 'active',
        createdAt: now + imported,
        updatedAt: now + imported,
      };
      toPut.push(newStu);
      workingStudents.push(newStu);
      imported++;
    }

    if (toPut.length > 0) {
      await db.students.bulkPut(toPut);
    }

    if (touchedClassIds.size > 1) {
      setClassFilter('all');
    } else if (touchedClassIds.size === 1) {
      const singleCid = Array.from(touchedClassIds)[0];
      if (classFilter !== 'all') {
        setClassFilter(singleCid);
      }
      setActiveClassId(singleCid);
    }

    await reloadAllFromDb();
    return { imported, updated, skipped, createdClasses };
  };

  const handleBulkDeleteStudents = async (studentIds: string[]) => {
    if (studentIds.length === 0) return;
    const idSet = new Set(studentIds);
    const targets = students.filter((s) => idSet.has(s.id));
    const blobIds = new Set<string>();
    for (const stu of targets) {
      for (const bid of [
        stu.avatarBlobId,
        stu.thumbnailBlobId,
        stu.fullBlobId,
        stu.originalPhotoBlobId,
      ]) {
        if (bid) blobIds.add(bid);
      }
    }
    for (const bid of blobIds) {
      await deleteBlobById(bid);
    }
    await db.students.bulkDelete(studentIds);
    await reloadAllFromDb();
  };

  const handleBulkUpdateStudents = async (updates: BulkStudentUpdateItem[]) => {
    if (updates.length === 0) return;
    const now = Date.now();
    const stuMap = new Map(students.map((s) => [s.id, s]));
    const recordsToPut: Student[] = [];
    for (let i = 0; i < updates.length; i++) {
      const u = updates[i];
      const existing = stuMap.get(u.id);
      if (!existing) continue;
      recordsToPut.push({
        ...existing,
        name: u.name,
        rollNumber: u.rollNumber,
        classId: u.classId,
        characterPresentation: u.characterPresentation,
        avatarConfig: u.avatarConfig,
        notes: u.notes,
        activeStatus: u.activeStatus ?? existing.activeStatus,
        isStarterSample: false,
        updatedAt: now + i,
      });
    }
    if (recordsToPut.length > 0) {
      await db.students.bulkPut(recordsToPut);
      await reloadAllFromDb();
    }
  };

  const handleConfirmPhotoReplace = async (params: {
    matchedStudentId?: string;
    classId: string;
    rollNumber: string;
    name: string;
    avatarDataUrl: string;
    thumbnailDataUrl: string;
    originalCroppedDataUrl?: string;
    keepOriginal: boolean;
    useOriginalDirectly: boolean;
  }) => {
    const now = Date.now();
    const fullBlobId = await saveBlobDataUrl(
      params.avatarDataUrl,
      detectMimeFromDataUrl(params.avatarDataUrl)
    );
    const thumbnailBlobId = await saveBlobDataUrl(
      params.thumbnailDataUrl,
      detectMimeFromDataUrl(params.thumbnailDataUrl)
    );
    const originalPhotoBlobId =
      params.keepOriginal && params.originalCroppedDataUrl
        ? await saveBlobDataUrl(
            params.originalCroppedDataUrl,
            detectMimeFromDataUrl(params.originalCroppedDataUrl, 'image/jpeg')
          )
        : undefined;

    if (params.matchedStudentId) {
      const existing = students.find((s) => s.id === params.matchedStudentId);
      if (existing) {
        const oldIds = new Set(
          [
            existing.avatarBlobId,
            existing.thumbnailBlobId,
            existing.fullBlobId,
            existing.originalPhotoBlobId,
          ].filter(Boolean) as string[]
        );
        for (const id of oldIds) {
          await deleteBlobById(id);
        }
        await db.students.put({
          ...existing,
          avatarSource: 'photo',
          avatarBlobId: fullBlobId,
          thumbnailBlobId,
          fullBlobId,
          originalPhotoBlobId,
          updatedAt: now,
        });
      }
    } else {
      const classConfigs = students
        .filter((s) => s.classId === params.classId)
        .map((s) => s.avatarConfig);
      const detectedGender = detectStudentGenderFromName(params.name);
      await db.students.put({
        id: createId('stu'),
        classId: params.classId,
        name: params.name,
        rollNumber: params.rollNumber,
        characterPresentation: detectedGender,
        avatarSource: 'photo',
        avatarConfig: pickUniqueAvatarConfig(detectedGender, classConfigs, undefined, {
          avatarKind: 'human',
          studentName: params.name,
        }),
        avatarBlobId: fullBlobId,
        thumbnailBlobId,
        fullBlobId,
        originalPhotoBlobId,
        activeStatus: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }
    await reloadAllFromDb();
  };

  const handleDeleteOriginalPhoto = async (stu: Student) => {
    if (!stu.originalPhotoBlobId) return;
    await deleteBlobById(stu.originalPhotoBlobId);
    await db.students.update(stu.id, {
      originalPhotoBlobId: undefined,
      updatedAt: Date.now(),
    });
    await reloadAllFromDb();
  };

  const handleUpdateSettings = async (partial: Partial<AppSettings>) => {
    const next = await saveAppSettings(partial);
    setSettings(next);
  };

  const handleRestoreBackup = async (
    payload: ClasspackPayload,
    mode: 'replace' | 'merge_skip'
  ) => {
    const { data } = payload;
    await db.transaction(
      'rw',
      [
        db.classes,
        db.students,
        db.blobs,
        db.sessions,
        db.dailyAttendance,
        db.activities,
        db.selections,
        db.questions,
        db.rewards,
      ],
      async () => {
        if (mode === 'replace') {
          await Promise.all([
            db.classes.clear(),
            db.students.clear(),
            db.blobs.clear(),
            db.sessions.clear(),
            db.dailyAttendance.clear(),
            db.activities.clear(),
            db.selections.clear(),
            db.questions.clear(),
            db.rewards.clear(),
          ]);
          await db.classes.bulkPut(data.classes);
          await db.students.bulkPut(data.students);
          await db.blobs.bulkPut(data.blobs);
          await db.sessions.bulkPut(data.sessions);
          if (data.dailyAttendance && data.dailyAttendance.length > 0) {
            await db.dailyAttendance.bulkPut(data.dailyAttendance);
          }
          await db.activities.bulkPut(data.activities);
          await db.selections.bulkPut(data.selections);
          await db.questions.bulkPut(data.questions);
          await db.rewards.bulkPut(data.rewards);
        } else {
          const existingClassIds = new Set((await db.classes.toArray()).map((c) => c.id));
          const existingStuIds = new Set((await db.students.toArray()).map((s) => s.id));
          const existingBlobIds = new Set((await db.blobs.toArray()).map((b) => b.id));
          const existingSessIds = new Set((await db.sessions.toArray()).map((s) => s.id));
          const existingDailyAttIds = new Set((await db.dailyAttendance.toArray()).map((r) => r.id));
          const existingActIds = new Set((await db.activities.toArray()).map((a) => a.id));
          const existingSelIds = new Set((await db.selections.toArray()).map((s) => s.id));
          const existingQIds = new Set((await db.questions.toArray()).map((q) => q.id));
          const existingRewIds = new Set((await db.rewards.toArray()).map((r) => r.id));

          await db.classes.bulkPut(data.classes.filter((c) => !existingClassIds.has(c.id)));
          await db.students.bulkPut(data.students.filter((s) => !existingStuIds.has(s.id)));
          await db.blobs.bulkPut(data.blobs.filter((b) => !existingBlobIds.has(b.id)));
          await db.sessions.bulkPut(data.sessions.filter((s) => !existingSessIds.has(s.id)));
          if (data.dailyAttendance && data.dailyAttendance.length > 0) {
            await db.dailyAttendance.bulkPut(
              data.dailyAttendance.filter((r) => !existingDailyAttIds.has(r.id))
            );
          }
          await db.activities.bulkPut(data.activities.filter((a) => !existingActIds.has(a.id)));
          await db.selections.bulkPut(data.selections.filter((s) => !existingSelIds.has(s.id)));
          await db.questions.bulkPut(data.questions.filter((q) => !existingQIds.has(q.id)));
          await db.rewards.bulkPut(data.rewards.filter((r) => !existingRewIds.has(r.id)));
        }
      }
    );
    await reloadAllFromDb();
  };

  const handleDestructiveResetAll = async () => {
    await db.transaction(
      'rw',
      [
        db.classes,
        db.students,
        db.blobs,
        db.sessions,
        db.dailyAttendance,
        db.activities,
        db.selections,
        db.questions,
        db.rewards,
        db.settings,
      ],
      async () => {
        await Promise.all([
          db.classes.clear(),
          db.students.clear(),
          db.blobs.clear(),
          db.sessions.clear(),
          db.dailyAttendance.clear(),
          db.activities.clear(),
          db.selections.clear(),
          db.questions.clear(),
          db.rewards.clear(),
          db.settings.clear(),
        ]);
      }
    );
    await ensureInitialDatabaseSeeded();
    await reloadAllFromDb();
    setHistoryStack([{ name: 'dashboard' }]);
  };

  // Canonical 4 Navigation Hubs
  const hubItems: Array<{
    id: HubId;
    label: string;
    mobileLabel: string;
    icon: React.ReactNode;
    route: RouteView;
  }> = [
    {
      id: 'classes_hub',
      label: 'Home',
      mobileLabel: 'Home',
      icon: <Home className="w-4 h-4" />,
      route: { name: 'dashboard' },
    },
    {
      id: 'roster_hub',
      label: 'Students & 3D',
      mobileLabel: 'Students',
      icon: <Users className="w-4 h-4" />,
      route: { name: 'roster_studio', tab: 'students' },
    },
    {
      id: 'decks_hub',
      label: 'Questions & Logs',
      mobileLabel: 'History',
      icon: <History className="w-4 h-4" />,
      route: { name: 'decks_history', tab: 'questions' },
    },
    {
      id: 'settings_hub',
      label: 'Settings',
      mobileLabel: 'Settings',
      icon: <Settings className="w-4 h-4" />,
      route: { name: 'settings' },
    },
  ];

  const activeHub = getActiveHub(currentRoute);

  const renderMainContent = () => {
    if (!ready) {
      return (
        <div className="py-20 text-center text-sm text-[var(--ink-muted)]">
          Loading...
        </div>
      );
    }

    switch (currentRoute.name) {
      case 'dashboard':
        return (
          <DashboardPage
            classes={classes}
            activeClassId={activeClassId}
            students={students}
            sessions={sessions}
            selections={selections}
            dailyAttendanceRecords={dailyAttendance}
            lastBackupAt={settings.lastBackupV2At ?? settings.lastBackupAt}
            onSelectClass={(classId) => {
              setActiveClassId(classId);
              if (classFilter !== 'all') {
                setClassFilter(classId);
              }
            }}
            onQuickLaunchActivity={(classId, type) => void handleQuickLaunchActivity(classId, type)}
            onStartSession={handleStartSession}
            onResumeSession={handleResumeSession}
            onOpenClassOverview={(classId) => {
              setActiveClassId(classId);
              navigateTo({ name: 'class_overview', classId });
            }}
            onOpenAttendance={(classId, tab) => handleOpenAttendance(classId, tab)}
            onOpenRoster={(classId, tab = 'students') => {
              setActiveClassId(classId);
              setClassFilter(classId);
              navigateTo({ name: 'roster_studio', tab });
            }}
            onAddStudent={() => {
              setEditingStudent(null);
              setStudentFormOpen(true);
            }}
            onImportStudents={() => setImportModalOpen(true)}
            onManageClasses={() => navigateTo({ name: 'classes' })}
            onGoBackup={() => navigateTo({ name: 'settings' })}
          />
        );

      case 'classes':
        return (
          <ClassesPage
            classes={classes}
            students={students}
            sessions={sessions}
            onCreateClass={async (name) => {
              const now = Date.now();
              await db.classes.put({ id: createId('cls'), name, createdAt: now, updatedAt: now });
              await reloadAllFromDb();
            }}
            onRenameClass={async (id, name) => {
              await db.classes.update(id, { name, updatedAt: Date.now() });
              await reloadAllFromDb();
            }}
            onToggleArchiveClass={async (id, archive) => {
              await db.classes.update(id, {
                archivedAt: archive ? Date.now() : undefined,
                updatedAt: Date.now(),
              });
              await reloadAllFromDb();
            }}
            onOpenClassOverview={(classId) => {
              setActiveClassId(classId);
              navigateTo({ name: 'class_overview', classId });
            }}
          />
        );

      case 'class_overview': {
        const cls = classes.find((c) => c.id === currentRoute.classId) ?? activeClasses[0];
        if (!cls) return null;
        const activeSess = sessions.find((s) => s.classId === cls.id && s.status === 'active') ?? null;
        const clsActivities = activities
          .filter((a) => a.classId === cls.id)
          .sort((a, b) => b.createdAt - a.createdAt);

        return (
          <ClassOverviewPage
            classRecord={cls}
            students={students}
            activeSession={activeSess}
            recentActivities={clsActivities}
            onResumeSession={() => handleResumeSession(cls.id)}
            onStartNewSession={() =>
              navigateTo({ name: 'attendance', classId: cls.id, mode: 'new_session', tab: 'daily_register' })
            }
            onEditAttendance={() =>
              activeSess &&
              navigateTo({
                name: 'attendance',
                classId: cls.id,
                mode: 'edit_session',
                sessionId: activeSess.id,
                tab: 'daily_register',
              })
            }
            onOpenAttendanceArchive={() => handleOpenAttendance(cls.id, 'archive')}
            onManageStudents={() => {
              setClassFilter(cls.id);
              navigateTo({ name: 'roster_studio', tab: 'students' });
            }}
            onOpenCardCollection={() => {
              setClassFilter(cls.id);
              navigateTo({ name: 'roster_studio', tab: 'cards' });
            }}
          />
        );
      }

      case 'attendance': {
        const cls = classes.find((c) => c.id === currentRoute.classId) ?? activeClasses[0];
        if (!cls) return null;
        const existingSess = currentRoute.sessionId
          ? sessions.find((s) => s.id === currentRoute.sessionId)
          : sessions.find((s) => s.classId === cls.id && s.status === 'active');
        return (
          <AttendancePage
            classRecord={cls}
            classes={classes}
            students={students}
            dailyAttendanceRecords={dailyAttendance}
            initialAbsentIds={existingSess?.absentStudentIds ?? []}
            isEditingExistingSession={currentRoute.mode === 'edit_session' || Boolean(existingSess)}
            initialTab={currentRoute.tab ?? 'daily_register'}
            initialBsDate={currentRoute.bsDate}
            onSelectClass={(nextClassId) => {
              setActiveClassId(nextClassId);
              const sessForClass = sessions.find(
                (s) => s.classId === nextClassId && s.status === 'active'
              );
              replaceTopRoute({
                ...currentRoute,
                classId: nextClassId,
                mode: sessForClass ? 'edit_session' : 'new_session',
                sessionId: sessForClass?.id,
              });
            }}
            onAutoSaveDailyAttendance={handleAutoSaveDailyAttendance}
            onConfirmAttendance={(absentIds, notes, bsDate) =>
              handleConfirmAttendance(
                cls.id,
                currentRoute.mode,
                existingSess?.id ?? currentRoute.sessionId,
                absentIds,
                notes,
                bsDate
              )
            }
            onAddStudentsShortcut={() => {
              setClassFilter(cls.id);
              navigateTo({ name: 'roster_studio', tab: 'students' });
            }}
          />
        );
      }

      case 'roster_studio':
        return (
          <RosterStudioHubPage
            activeTab={currentRoute.tab}
            onChangeTab={(tab) => replaceTopRoute({ name: 'roster_studio', tab })}
            classes={classes}
            students={students}
            selectedClassId={classFilter}
            cardBackTheme={settings.cardBackTheme}
            onSelectClassFilter={setClassFilter}
            onAddStudent={() => {
              setEditingStudent(null);
              setStudentFormOpen(true);
            }}
            onImportStudents={() => setImportModalOpen(true)}
            onEditStudent={(stu) => {
              setEditingStudent(stu);
              setStudentFormOpen(true);
            }}
            onUploadPhotoForStudent={(stu) => {
              setPhotoTargetStudent(stu ?? null);
              setPhotoModalOpen(true);
            }}
            onArchiveToggle={async (stu) => {
              await db.students.update(stu.id, {
                activeStatus: stu.activeStatus === 'active' ? 'archived' : 'active',
                updatedAt: Date.now(),
              });
              await reloadAllFromDb();
            }}
            onDeleteStudent={async (stu) => {
              const blobIds = new Set(
                [stu.avatarBlobId, stu.thumbnailBlobId, stu.fullBlobId, stu.originalPhotoBlobId].filter(
                  Boolean
                ) as string[]
              );
              for (const id of blobIds) {
                await deleteBlobById(id);
              }
              await db.students.delete(stu.id);
              await reloadAllFromDb();
            }}
            onBulkDeleteStudents={handleBulkDeleteStudents}
            onBulkUpdateStudents={handleBulkUpdateStudents}
            onUpdateStudentAvatar={async (studentId, cfg, presentation, switchToGenerated) => {
              const stu = students.find((s) => s.id === studentId);
              if (!stu) return;
              if (switchToGenerated) {
                const blobIds = new Set(
                  [stu.avatarBlobId, stu.thumbnailBlobId, stu.fullBlobId].filter(Boolean) as string[]
                );
                for (const id of blobIds) {
                  await deleteBlobById(id);
                }
              }
              await db.students.update(studentId, {
                avatarConfig: cfg,
                characterPresentation: presentation,
                avatarSource: switchToGenerated ? 'generated' : stu.avatarSource,
                avatarBlobId: switchToGenerated ? undefined : stu.avatarBlobId,
                thumbnailBlobId: switchToGenerated ? undefined : stu.thumbnailBlobId,
                fullBlobId: switchToGenerated ? undefined : stu.fullBlobId,
                updatedAt: Date.now(),
              });
              await reloadAllFromDb();
            }}
            onDeleteOriginalPhoto={handleDeleteOriginalPhoto}
            onChangeCardBackTheme={(theme: CardBackTheme) => handleUpdateSettings({ cardBackTheme: theme })}
          />
        );

      case 'activity_center': {
        const cls = classes.find((c) => c.id === currentRoute.classId);
        const sess = sessions.find((s) => s.id === currentRoute.sessionId);
        if (!cls || !sess) return null;
        return (
          <ActivityCenterPage
            classRecord={cls}
            session={sess}
            students={students}
            selections={selections}
            questions={questions}
            rewards={rewards}
            defaultSelectionMode={settings.defaultSelectionMode}
            defaultRepeatPolicy={settings.defaultRepeatPolicy}
            fairnessScope={settings.fairnessScope}
            onLaunchActivity={(cfg) => handleLaunchActivity(cls.id, sess.id, cfg)}
            onEditAttendance={() =>
              navigateTo({
                name: 'attendance',
                classId: cls.id,
                mode: 'edit_session',
                sessionId: sess.id,
                tab: 'daily_register',
              })
            }
          />
        );
      }

      case 'mystery_deck': {
        const cls = classes.find((c) => c.id === currentRoute.classId);
        const sess = sessions.find((s) => s.id === currentRoute.sessionId);
        const act = activities.find((a) => a.id === currentRoute.activityId);
        if (!cls || !sess || !act) return null;

        const recentSessionIds = sessions
          .filter((s) => s.classId === cls.id && s.id !== sess.id)
          .sort((a, b) => b.startedAt - a.startedAt)
          .slice(0, 5)
          .map((s) => s.id);

        return (
          <MysteryDeckPage
            activity={act}
            classRecord={cls}
            session={sess}
            students={students}
            selections={selections}
            recentSessionIds={recentSessionIds}
            questions={questions}
            rewards={rewards}
            settings={settings}
            questionSubject={currentRoute.questionSubject}
            onUpdateActivity={async (next) => {
              await db.activities.put(next);
              await reloadAllFromDb();
            }}
            onRecordSelection={async (sel) => {
              await db.selections.put({ id: createId('sel'), ...sel });
              await reloadAllFromDb();
            }}
            onMarkLastSelectionUndone={async (activityId, studentId) => {
              const matching = selections
                .filter((s) => s.activityId === activityId && s.studentId === studentId && !s.undoneAt)
                .sort((a, b) => b.selectedAt - a.selectedAt);
              if (matching[0]) {
                await db.selections.update(matching[0].id, { undoneAt: Date.now() });
                await reloadAllFromDb();
              }
            }}
            onResetActivitySelectionsInDb={async (activityId) => {
              const toUndo = selections.filter((s) => s.activityId === activityId && !s.undoneAt);
              const now = Date.now();
              for (const item of toUndo) {
                await db.selections.update(item.id, { undoneAt: now });
              }
              await reloadAllFromDb();
            }}
            onStartNewRound={() =>
              handleLaunchActivity(cls.id, sess.id, {
                type: act.type,
                selectionMode: act.selectionMode,
                repeatPolicy: act.repeatPolicy,
                questionSubject: currentRoute.questionSubject,
                dutyTitle: act.dutyTitle,
              })
            }
            onChooseAnotherActivity={() =>
              navigateTo({ name: 'activity_center', classId: cls.id, sessionId: sess.id })
            }
            onReturnToClassOverview={() =>
              navigateTo({ name: 'class_overview', classId: cls.id })
            }
          />
        );
      }

      case 'group_generator': {
        const cls = classes.find((c) => c.id === currentRoute.classId);
        const sess = sessions.find((s) => s.id === currentRoute.sessionId);
        if (!cls || !sess) return null;
        return (
          <GroupGeneratorPage
            classRecord={cls}
            session={sess}
            students={students}
            onSwitchActivity={() =>
              navigateTo({ name: 'activity_center', classId: cls.id, sessionId: sess.id })
            }
            onSaveConfirmedGroups={async (groups: GeneratedGroup[]) => {
              const now = Date.now();
              const actId = createId('act');
              await db.activities.put({
                id: actId,
                sessionId: sess.id,
                classId: cls.id,
                type: 'groups',
                selectionMode: 'pure_random',
                repeatPolicy: 'no_repeat',
                fairnessScope: settings.fairnessScope,
                status: 'completed',
                deckSlots: [],
                selectedStudentIds: groups.flatMap((g) => g.studentIds),
                groups,
                createdAt: now,
                completedAt: now,
              });
              let order = 1;
              for (const grp of groups) {
                for (const stuId of grp.studentIds) {
                  await db.selections.put({
                    id: createId('sel'),
                    activityId: actId,
                    sessionId: sess.id,
                    classId: cls.id,
                    studentId: stuId,
                    selectionOrder: order++,
                    selectedAt: now,
                    groupIndex: grp.groupNumber,
                  });
                }
              }
              await reloadAllFromDb();
            }}
          />
        );
      }

      case 'decks_history':
        return (
          <DecksHistoryHubPage
            activeTab={currentRoute.tab}
            onChangeTab={(tab) => replaceTopRoute({ name: 'decks_history', tab })}
            classes={classes}
            students={students}
            sessions={sessions}
            activities={activities}
            selections={selections}
            questions={questions}
            rewards={rewards}
            onAddQuestion={async (subject, text) => {
              const now = Date.now();
              await db.questions.put({ id: createId('q'), subject, text, createdAt: now, updatedAt: now });
              await reloadAllFromDb();
            }}
            onDeleteQuestion={async (id) => {
              await db.questions.delete(id);
              await reloadAllFromDb();
            }}
            onBulkImportQuestions={async (items) => {
              const now = Date.now();
              await db.questions.bulkPut(
                items.map((item, idx) => ({
                  id: createId('q'),
                  subject: item.subject,
                  text: item.text,
                  createdAt: now + idx,
                  updatedAt: now + idx,
                }))
              );
              await reloadAllFromDb();
              return items.length;
            }}
            onAddRewardItem={async (kind, text) => {
              await db.rewards.put({ id: createId('rew'), kind, text, createdAt: Date.now() });
              await reloadAllFromDb();
            }}
            onDeleteRewardItem={async (id) => {
              await db.rewards.delete(id);
              await reloadAllFromDb();
            }}
          />
        );

      case 'settings':
        return (
          <SettingsBackupPage
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onRestoreBackup={handleRestoreBackup}
            onDestructiveResetAllData={handleDestructiveResetAll}
          />
        );
    }
  };

  const isDeckRoute = currentRoute.name === 'mystery_deck';
  const hasActiveSessionForCurrentClass = sessions.some(
    (s) => s.classId === activeClassId && s.status === 'active'
  );

  return (
    <div className="min-h-screen flex bg-[var(--canvas)] text-[var(--ink)]">
      {/* Slim Desktop Left Rail (hidden on mobile and short rotated mobile landscape) */}
      <aside className="no-print hidden md:[@media(min-height:541px)]:flex md:w-56 md:flex-col md:fixed md:inset-y-0 bg-[var(--surface)] border-r border-[var(--border-hairline)] z-30">
        <div className="px-4 py-3.5 border-b border-[var(--border-hairline)]">
          <button
            type="button"
            data-testid="sidebar-brand-btn"
            onClick={() => navigateTo({ name: 'dashboard' })}
            className="flex items-center gap-2.5 text-left cursor-pointer group w-full"
          >
            <img
              src="/pwa-192x192.png"
              alt="Classroom Helper"
              className="w-9 h-9 rounded-xl object-cover shrink-0 border border-[var(--border-hairline)]"
            />
            <span className="font-display font-bold text-sm text-[var(--ink)] tracking-tight leading-tight truncate">
              Classroom Helper
            </span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto" aria-label="Primary navigation">
          {hubItems.map((hub) => {
            const isActive = activeHub === hub.id && currentRoute.name !== 'attendance' && currentRoute.name !== 'classes';
            return (
              <button
                key={hub.id}
                type="button"
                onClick={() => navigateTo(hub.route)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                    : 'text-[var(--ink-muted)] font-medium hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]'
                }`}
              >
                <span>{hub.icon}</span>
                <span>{hub.label}</span>
              </button>
            );
          })}

          <div className="pt-2.5 mt-2.5 border-t border-[var(--border-hairline)] space-y-1">
            <button
              type="button"
              data-testid="nav-attendance-register-btn"
              onClick={() => handleOpenAttendance(activeClassId, 'daily_register')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                currentRoute.name === 'attendance' && currentRoute.tab !== 'archive'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                  : 'text-[var(--ink-muted)] font-medium hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Daily Attendance</span>
            </button>
            <button
              type="button"
              data-testid="nav-attendance-archive-btn"
              onClick={() => handleOpenAttendance(activeClassId, 'archive')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                currentRoute.name === 'attendance' && currentRoute.tab === 'archive'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                  : 'text-[var(--ink-muted)] font-medium hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Monthly Archive</span>
            </button>
            <button
              type="button"
              onClick={() => navigateTo({ name: 'classes' })}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                currentRoute.name === 'classes'
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-semibold'
                  : 'text-[var(--ink-muted)] font-medium hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Classes</span>
            </button>
          </div>
        </nav>

        {!isInstalled && isInstallable && (
          <div className="px-3 py-3 border-t border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={install}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-semibold text-white cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Install App
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Navigation Drawer (used on short landscape where bottom bar & rail hide) */}
      {mobileNavOpen && (
        <div className="no-print fixed inset-0 z-50 md:[@media(min-height:541px)]:hidden flex">
          <div className="fixed inset-0 bg-black/45" onClick={() => setMobileNavOpen(false)} />
          <div className="relative w-72 max-w-[82vw] bg-[var(--surface)] h-full p-4 flex flex-col justify-between shadow-xl z-10 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-hairline)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src="/pwa-192x192.png"
                    alt="Classroom Helper 3D Icon"
                    className="w-9 h-9 rounded-xl object-cover shrink-0 shadow-xs border border-[var(--border-hairline)]"
                  />
                  <div className="min-w-0">
                    <span className="block font-display font-bold text-base text-[var(--ink)] truncate">
                      Classroom Helper
                    </span>
                    <span className="block text-[10px] text-[var(--ink-muted)] truncate">
                      Home Menu · Offline App
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-2 rounded-lg text-[var(--ink-muted)] cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="mt-3 space-y-1" aria-label="Mobile navigation">
                {hubItems.map((hub) => {
                  const isActive = activeHub === hub.id;
                  return (
                    <button
                      key={hub.id}
                      type="button"
                      onClick={() => navigateTo(hub.route)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer ${
                        isActive
                          ? 'bg-[var(--surface-subtle)] text-[var(--ink)] font-semibold'
                          : 'text-[var(--ink-muted)] font-medium hover:bg-[var(--surface-subtle)]/60'
                      }`}
                    >
                      <span className={isActive ? 'text-[var(--accent)]' : 'text-[var(--ink-muted)]'}>
                        {hub.icon}
                      </span>
                      <span>{hub.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleOpenAttendance(activeClassId, 'daily_register')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]/60 cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Daily Attendance (BS)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAttendance(activeClassId, 'archive')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]/60 cursor-pointer"
                >
                  <History className="w-4 h-4" />
                  <span>Attendance Archive (BS)</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo({ name: 'classes' })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--ink-muted)] hover:bg-[var(--surface-subtle)]/60 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Manage Classes</span>
                </button>
              </nav>
            </div>
            <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center gap-2 text-xs text-[var(--ink-muted)]">
              <img
                src="/pwa-192x192.png"
                alt=""
                className="w-5 h-5 rounded-md object-cover shrink-0"
              />
              <span>Classroom Helper · Offline Ready</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className={`flex-1 md:[@media(min-height:541px)]:pl-56 flex flex-col min-w-0 ${
          isDeckRoute ? 'h-dvh overflow-hidden' : ''
        }`}
      >
        {/* Top Bar with Top-Left Global Back + Class Selector */}
        <header className="no-print shrink-0 sticky top-0 z-20 bg-[var(--canvas)]/95 backdrop-blur-xs border-b border-[var(--border-hairline)] safe-area-header">
          <div
            className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-3 ${
              isDeckRoute ? 'py-1 sm:py-1.5 [@media(max-height:480px)]:py-1' : 'py-2.5 [@media(max-height:480px)]:py-1.5'
            }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation menu"
                className="md:[@media(min-height:541px)]:hidden p-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface)] text-[var(--ink)] cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                <Menu className="w-4 h-4" />
                <img
                  src="/pwa-192x192.png"
                  alt="Classroom Helper"
                  className="w-5 h-5 rounded-md object-cover"
                />
              </button>

              {historyStack.length > 1 && currentRoute.name !== 'dashboard' && (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs sm:text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}

              <div className="flex items-center gap-2 min-w-0">
                <label htmlFor="global-class-select" className="sr-only">
                  Active Class
                </label>
                <select
                  id="global-class-select"
                  value={activeClassId}
                  onChange={(e) => handleGlobalClassSelect(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs sm:text-sm font-semibold text-[var(--ink)] cursor-pointer max-w-[140px] sm:max-w-none truncate"
                >
                  {activeClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isOnline && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--gold)]">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Offline</span>
                </span>
              )}
              {!isDeckRoute && (
                <button
                  type="button"
                  onClick={() => {
                    if (hasActiveSessionForCurrentClass) {
                      handleResumeSession(activeClassId);
                    } else {
                      void handleQuickLaunchActivity(activeClassId, 'single_pick');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs sm:text-sm font-semibold text-white cursor-pointer whitespace-nowrap"
                >
                  {hasActiveSessionForCurrentClass ? 'Resume Pick' : 'Pick Cards'}
                </button>
              )}
            </div>
          </div>
        </header>

        <main className={isDeckRoute ? 'flex-1 min-h-0 overflow-hidden flex flex-col safe-area-x' : 'flex-1 safe-area-x'}>
          <div
            className={
              isDeckRoute
                ? 'max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-1.5 sm:py-2.5 flex-1 min-h-0 flex flex-col'
                : 'max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-20 md:pb-10 [@media(max-height:480px)]:pb-5'
            }
          >
            {renderMainContent()}
          </div>
        </main>

        {/* 4-Tab Mobile Portrait Bottom Navigation (hidden during active Mystery Deck & short landscape heights) */}
        {!isDeckRoute && (
          <nav
            className="no-print md:hidden [@media(max-height:480px)]:hidden fixed bottom-0 inset-x-0 z-20 bg-[var(--surface)] border-t border-[var(--border-hairline)] grid grid-cols-4 px-1 pt-1.5 safe-area-bottom"
            aria-label="Quick mobile navigation"
          >
            {hubItems.map((hub) => {
              const active = activeHub === hub.id;
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => navigateTo(hub.route)}
                  className={`flex flex-col items-center justify-center py-1 rounded-lg text-[11px] font-medium cursor-pointer ${
                    active ? 'text-[var(--accent)] font-semibold' : 'text-[var(--ink-muted)]'
                  }`}
                >
                  {hub.icon}
                  <span className="mt-0.5">{hub.mobileLabel}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Shared Modals */}
      <StudentFormModal
        open={studentFormOpen}
        classes={classes}
        defaultClassId={classFilter !== 'all' ? classFilter : activeClassId}
        editingStudent={editingStudent}
        existingStudents={students}
        onSave={handleSaveStudent}
        onClose={() => {
          setStudentFormOpen(false);
          setEditingStudent(null);
        }}
      />

      <ImportStudentsModal
        open={importModalOpen}
        classes={classes}
        defaultClassId={classFilter !== 'all' ? classFilter : activeClassId}
        existingStudents={students}
        onImportConfirm={handleImportStudentsConfirm}
        onClose={() => setImportModalOpen(false)}
      />

      <PhotoUploadModal
        open={photoModalOpen}
        classes={classes}
        students={students}
        initialClassId={classFilter !== 'all' ? classFilter : activeClassId}
        initialStudent={photoTargetStudent}
        onConfirmPhotoReplace={handleConfirmPhotoReplace}
        onClose={() => {
          setPhotoModalOpen(false);
          setPhotoTargetStudent(null);
        }}
      />
    </div>
  );
}
