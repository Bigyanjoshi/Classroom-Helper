import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  RotateCcw,
  Search,
  StickyNote,
  UserMinus,
} from 'lucide-react';
import {
  BS_CALENDAR_MONTH_DAYS,
  buildDailyAttendanceRecord,
  fetchNepaliPatroToday,
  formatBsDateString,
  formatBsMonthKey,
  getBsMonthDays,
  getNepaliMonthCalendar,
  getTodayNepaliDate,
  groupAttendanceArchive,
  makeDailyAttendanceId,
  MAX_BS_YEAR,
  MIN_BS_YEAR,
  NEPALI_MONTH_NAMES_EN,
  NEPALI_MONTH_NAMES_NP,
  parseBsDateString,
  stepNepaliDay,
  stepNepaliMonth,
  WEEKDAY_SHORT_EN,
} from '../domain/nepaliCalendar';
import { parseRollNumberInput, sortStudentsNaturally } from '../domain/random';
import type {
  ClassRecord,
  DailyAttendanceRecord,
  Student,
} from '../domain/types';
import { buildCsvDocument, downloadTextFile } from '../services/exportService';

export type AttendanceViewTab = 'daily_register' | 'archive';

interface AttendancePageProps {
  classRecord: ClassRecord;
  classes: ClassRecord[];
  students: Student[];
  dailyAttendanceRecords: DailyAttendanceRecord[];
  initialAbsentIds: string[];
  isEditingExistingSession: boolean;
  initialTab?: AttendanceViewTab;
  initialBsDate?: string;
  onSelectClass: (classId: string) => void;
  onAutoSaveDailyAttendance: (record: DailyAttendanceRecord) => Promise<void>;
  onConfirmAttendance: (absentIds: string[], notes: string, bsDate: string) => Promise<void>;
  onAddStudentsShortcut: () => void;
}

export const AttendancePage: React.FC<AttendancePageProps> = ({
  classRecord,
  classes,
  students,
  dailyAttendanceRecords,
  initialAbsentIds,
  isEditingExistingSession,
  initialTab = 'daily_register',
  initialBsDate,
  onSelectClass,
  onAutoSaveDailyAttendance,
  onConfirmAttendance,
  onAddStudentsShortcut,
}) => {
  const [nepaliPatroTodayBs, setNepaliPatroTodayBs] = useState<string | null>(null);
  const todayBs = useMemo(
    () => (nepaliPatroTodayBs ? parseBsDateString(nepaliPatroTodayBs) : null) ?? getTodayNepaliDate(),
    [nepaliPatroTodayBs]
  );
  const activeClasses = useMemo(() => classes.filter((c) => !c.archivedAt), [classes]);

  const [activeTab, setActiveTab] = useState<AttendanceViewTab>(initialTab);
  const [selectedBsDate, setSelectedBsDate] = useState<string>(
    initialBsDate || todayBs.bsDateString
  );

  // Verify Today's BS date live with Nepali Patro API (`api.nepalipatro.com.np/calendars/today`)
  useEffect(() => {
    let cancelled = false;
    fetchNepaliPatroToday()
      .then((liveToday) => {
        if (cancelled) return;
        setNepaliPatroTodayBs(liveToday.bsDateString);
        if (!initialBsDate) {
          setSelectedBsDate((prev) =>
            prev === getTodayNepaliDate().bsDateString ? liveToday.bsDateString : prev
          );
        }
      })
      .catch(() => {
        // Offline-first fallback uses verified local BS_CALENDAR_MONTH_DAYS table
      });
    return () => {
      cancelled = true;
    };
  }, [initialBsDate]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialBsDate && parseBsDateString(initialBsDate)) {
      setSelectedBsDate(initialBsDate);
    }
  }, [initialBsDate]);

  const selectedDateInfo = useMemo(
    () => parseBsDateString(selectedBsDate) ?? todayBs,
    [selectedBsDate, todayBs]
  );

  const isSelectedDateToday = selectedDateInfo.bsDateString === todayBs.bsDateString;

  const activeRoster = useMemo(
    () =>
      sortStudentsNaturally(
        students.filter((s) => s.classId === classRecord.id && s.activeStatus === 'active')
      ),
    [students, classRecord.id]
  );

  // Lookup existing DailyAttendanceRecord for (classRecord.id, selectedDateInfo.bsDateString)
  const existingRecordForDate = useMemo(() => {
    const targetId = makeDailyAttendanceId(classRecord.id, selectedDateInfo.bsDateString);
    return dailyAttendanceRecords.find(
      (r) =>
        r.id === targetId ||
        (r.classId === classRecord.id && r.bsDate === selectedDateInfo.bsDateString)
    );
  }, [dailyAttendanceRecords, classRecord.id, selectedDateInfo.bsDateString]);

  // Derive initial absent IDs from saved record if present; otherwise fallback to initialAbsentIds on Today
  const derivedAbsentIdsFromRecord = useMemo(() => {
    if (existingRecordForDate) {
      return existingRecordForDate.studentRecords
        .filter((sr) => sr.status === 'absent')
        .map((sr) => sr.studentId);
    }
    if (isSelectedDateToday && isEditingExistingSession) {
      return initialAbsentIds;
    }
    return [];
  }, [existingRecordForDate, initialAbsentIds, isEditingExistingSession, isSelectedDateToday]);

  const [absentIds, setAbsentIds] = useState<string[]>(derivedAbsentIdsFromRecord);
  const [unifiedInput, setUnifiedInput] = useState('');
  const [rollFeedback, setRollFeedback] = useState<{
    unknown: string[];
    duplicates: string[];
    appliedCount: number;
  } | null>(null);
  const [notes, setNotes] = useState<string>(existingRecordForDate?.notes ?? '');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedStatus, setLastSavedStatus] = useState<string | null>(null);

  // Sync local state when class or BS date changes or when an existing record loads from DB
  const loadedContextKey = `${classRecord.id}_${selectedDateInfo.bsDateString}`;
  const prevLoadedContextRef = useRef<string>('');
  useEffect(() => {
    if (prevLoadedContextRef.current !== loadedContextKey) {
      prevLoadedContextRef.current = loadedContextKey;
      setAbsentIds(derivedAbsentIdsFromRecord);
      setNotes(existingRecordForDate?.notes ?? '');
      setRollFeedback(null);
      setUnifiedInput('');
      setLastSavedStatus(
        existingRecordForDate
          ? `Loaded saved BS record (${existingRecordForDate.presentCount} present, ${existingRecordForDate.absentCount} absent)`
          : null
      );
    }
  }, [loadedContextKey, derivedAbsentIdsFromRecord, existingRecordForDate]);

  // Also ensure that if today's attendance is opened for the first time and has active students,
  // we persist/ensure today's record in IndexedDB so opening today's attendance again loads it cleanly.
  const autoInitializedTodayRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (
      activeRoster.length === 0 ||
      !isSelectedDateToday ||
      existingRecordForDate ||
      autoInitializedTodayRef.current.has(loadedContextKey)
    ) {
      return;
    }
    autoInitializedTodayRef.current.add(loadedContextKey);
    const initialRec = buildDailyAttendanceRecord({
      classRecord,
      students,
      absentStudentIds: derivedAbsentIdsFromRecord,
      bsDateInfo: selectedDateInfo,
      notes: '',
    });
    void onAutoSaveDailyAttendance(initialRec);
  }, [
    activeRoster.length,
    classRecord,
    derivedAbsentIdsFromRecord,
    existingRecordForDate,
    isSelectedDateToday,
    loadedContextKey,
    onAutoSaveDailyAttendance,
    selectedDateInfo,
    students,
  ]);

  const persistAttendanceUpdate = useCallback(
    async (nextAbsentIds: string[], nextNotes = notes, targetDateInfo = selectedDateInfo) => {
      if (activeRoster.length === 0) return;
      const existing = dailyAttendanceRecords.find(
        (r) => r.classId === classRecord.id && r.bsDate === targetDateInfo.bsDateString
      );
      const record = buildDailyAttendanceRecord({
        classRecord,
        students,
        absentStudentIds: nextAbsentIds,
        bsDateInfo: targetDateInfo,
        notes: nextNotes,
        existingRecord: existing,
      });
      await onAutoSaveDailyAttendance(record);
      setLastSavedStatus(
        `Saved ${targetDateInfo.monthNameEn} ${targetDateInfo.bsDay}, ${targetDateInfo.bsYear} BS (${record.presentCount} Present, ${record.absentCount} Absent)`
      );
    },
    [
      activeRoster.length,
      classRecord,
      dailyAttendanceRecords,
      notes,
      onAutoSaveDailyAttendance,
      selectedDateInfo,
      students,
    ]
  );

  const absentSet = useMemo(() => new Set(absentIds), [absentIds]);

  const looksLikeRollBatch = useMemo(() => {
    const trimmed = unifiedInput.trim();
    if (!trimmed) return false;
    return /^[\d,\s-]+$/.test(trimmed) || trimmed.includes(',');
  }, [unifiedInput]);

  const filteredRoster = useMemo(() => {
    const q = unifiedInput.trim().toLowerCase();
    if (!q || q.includes(',')) return activeRoster;
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && tokens.every((t) => /^\d+$/.test(t))) {
      return activeRoster;
    }
    return activeRoster.filter(
      (s) => s.name.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q)
    );
  }, [activeRoster, unifiedInput]);

  const presentCount = activeRoster.length - absentIds.length;
  const allAbsent = activeRoster.length > 0 && presentCount === 0;

  const toggleAbsent = (studentId: string) => {
    const next = absentIds.includes(studentId)
      ? absentIds.filter((id) => id !== studentId)
      : [...absentIds, studentId];
    setAbsentIds(next);
    void persistAttendanceUpdate(next, notes);
  };

  const applyRollInput = (): { hasUnknown: boolean; nextAbsentIds: string[] } => {
    const trimmed = unifiedInput.trim();
    if (!trimmed) {
      return { hasUnknown: false, nextAbsentIds: absentIds };
    }
    const parsed = parseRollNumberInput(trimmed, activeRoster);
    setRollFeedback({
      unknown: parsed.unknownRolls,
      duplicates: parsed.duplicateRolls,
      appliedCount: parsed.validStudentIds.length,
    });

    if (parsed.validStudentIds.length > 0) {
      const merged = Array.from(new Set([...absentIds, ...parsed.validStudentIds]));
      setAbsentIds(merged);
      void persistAttendanceUpdate(merged, notes);
      if (parsed.unknownRolls.length === 0) {
        setUnifiedInput('');
      }
      return { hasUnknown: parsed.unknownRolls.length > 0, nextAbsentIds: merged };
    }
    return { hasUnknown: parsed.unknownRolls.length > 0, nextAbsentIds: absentIds };
  };

  const handleResetAllPresent = () => {
    setAbsentIds([]);
    setRollFeedback(null);
    void persistAttendanceUpdate([], notes);
  };

  const handleConfirmNow = async () => {
    let finalAbsentIds = absentIds;
    if (looksLikeRollBatch && unifiedInput.trim()) {
      const res = applyRollInput();
      if (res.hasUnknown) return;
      finalAbsentIds = res.nextAbsentIds;
    }
    if (activeRoster.length - finalAbsentIds.length === 0) return;

    setSaving(true);
    try {
      await persistAttendanceUpdate(finalAbsentIds, notes.trim());
      if (isSelectedDateToday) {
        await onConfirmAttendance(finalAbsentIds, notes.trim(), selectedDateInfo.bsDateString);
      } else {
        setLastSavedStatus(
          `Saved attendance for ${selectedDateInfo.monthNameEn} ${selectedDateInfo.bsDay}, ${selectedDateInfo.bsYear} BS`
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // --- Attendance Archive State (Attendance -> Nepali Month -> Class -> Date -> Student Records) ---
  const [archiveYear, setArchiveYear] = useState<number>(todayBs.bsYear);
  const [archiveMonth, setArchiveMonth] = useState<number>(todayBs.bsMonth);
  const [archiveClassId, setArchiveClassId] = useState<string>(classRecord.id);
  const [archiveSelectedDate, setArchiveSelectedDate] = useState<string>(todayBs.bsDateString);

  useEffect(() => {
    setArchiveClassId(classRecord.id);
  }, [classRecord.id]);

  const archiveMonthKey = useMemo(
    () => formatBsMonthKey(archiveYear, archiveMonth),
    [archiveYear, archiveMonth]
  );

  const archiveMonthCalendar = useMemo(
    () => getNepaliMonthCalendar(archiveYear, archiveMonth),
    [archiveYear, archiveMonth]
  );

  const groupedArchive = useMemo(
    () => groupAttendanceArchive(dailyAttendanceRecords, classes),
    [dailyAttendanceRecords, classes]
  );

  // Records matching the selected Nepali Month + Class
  const monthClassRecords = useMemo(() => {
    return dailyAttendanceRecords
      .filter((r) => r.bsMonthKey === archiveMonthKey && r.classId === archiveClassId)
      .sort((a, b) => b.bsDate.localeCompare(a.bsDate));
  }, [dailyAttendanceRecords, archiveMonthKey, archiveClassId]);

  const monthClassRecordByDate = useMemo(() => {
    const map = new Map<string, DailyAttendanceRecord>();
    for (const r of monthClassRecords) {
      map.set(r.bsDate, r);
    }
    return map;
  }, [monthClassRecords]);

  // Keep archiveSelectedDate synced to a valid date inside the selected Nepali month
  useEffect(() => {
    const parsed = parseBsDateString(archiveSelectedDate);
    if (!parsed || parsed.bsYear !== archiveYear || parsed.bsMonth !== archiveMonth) {
      if (monthClassRecords.length > 0) {
        setArchiveSelectedDate(monthClassRecords[0].bsDate);
      } else if (archiveYear === todayBs.bsYear && archiveMonth === todayBs.bsMonth) {
        setArchiveSelectedDate(todayBs.bsDateString);
      } else {
        setArchiveSelectedDate(formatBsDateString(archiveYear, archiveMonth, 1));
      }
    }
  }, [archiveYear, archiveMonth, archiveSelectedDate, monthClassRecords, todayBs]);

  const archiveClassObj = useMemo(
    () => classes.find((c) => c.id === archiveClassId) ?? classRecord,
    [classes, archiveClassId, classRecord]
  );

  const archiveClassRoster = useMemo(
    () =>
      sortStudentsNaturally(
        students.filter((s) => s.classId === archiveClassObj.id && s.activeStatus === 'active')
      ),
    [students, archiveClassObj.id]
  );

  const selectedArchiveDateRecord = useMemo(
    () => monthClassRecordByDate.get(archiveSelectedDate) ?? null,
    [monthClassRecordByDate, archiveSelectedDate]
  );

  const selectedArchiveDateInfo = useMemo(
    () => parseBsDateString(archiveSelectedDate) ?? todayBs,
    [archiveSelectedDate, todayBs]
  );

  // Monthly per-student attendance summary for (archiveMonthKey, archiveClassId)
  const monthlyStudentTallies = useMemo(() => {
    return archiveClassRoster.map((stu) => {
      let daysPresent = 0;
      let daysAbsent = 0;
      for (const rec of monthClassRecords) {
        const entry = rec.studentRecords.find((sr) => sr.studentId === stu.id);
        if (entry) {
          if (entry.status === 'present') daysPresent++;
          else daysAbsent++;
        }
      }
      const totalDays = daysPresent + daysAbsent;
      const pct = totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : null;
      return {
        student: stu,
        daysPresent,
        daysAbsent,
        totalDays,
        pct,
      };
    });
  }, [archiveClassRoster, monthClassRecords]);

  const handleToggleArchiveStudentStatus = async (studentId: string) => {
    const existing = selectedArchiveDateRecord;
    const currentAbsentIds = existing
      ? existing.studentRecords.filter((sr) => sr.status === 'absent').map((sr) => sr.studentId)
      : [];
    const nextAbsentIds = currentAbsentIds.includes(studentId)
      ? currentAbsentIds.filter((id) => id !== studentId)
      : [...currentAbsentIds, studentId];

    const updated = buildDailyAttendanceRecord({
      classRecord: archiveClassObj,
      students,
      absentStudentIds: nextAbsentIds,
      bsDateInfo: selectedArchiveDateInfo,
      notes: existing?.notes,
      existingRecord: existing,
    });
    await onAutoSaveDailyAttendance(updated);
    if (
      archiveClassObj.id === classRecord.id &&
      selectedArchiveDateInfo.bsDateString === selectedDateInfo.bsDateString
    ) {
      setAbsentIds(nextAbsentIds);
    }
  };

  const handleRecordAllPresentInArchiveDate = async () => {
    const updated = buildDailyAttendanceRecord({
      classRecord: archiveClassObj,
      students,
      absentStudentIds: [],
      bsDateInfo: selectedArchiveDateInfo,
      notes: selectedArchiveDateRecord?.notes,
      existingRecord: selectedArchiveDateRecord,
    });
    await onAutoSaveDailyAttendance(updated);
    if (
      archiveClassObj.id === classRecord.id &&
      selectedArchiveDateInfo.bsDateString === selectedDateInfo.bsDateString
    ) {
      setAbsentIds([]);
    }
  };

  const handleExportMonthlyCsv = () => {
    const monthName = NEPALI_MONTH_NAMES_EN[archiveMonth - 1];
    const headers = [
      'BS Date',
      'Nepali Month',
      'Day',
      'Weekday',
      'Week of Month',
      'Class',
      'Roll Number',
      'Student Name',
      'Status',
    ];
    const rows: Array<Array<string | number>> = [];
    for (const rec of [...monthClassRecords].sort((a, b) => a.bsDate.localeCompare(b.bsDate))) {
      for (const sr of rec.studentRecords) {
        rows.push([
          rec.bsDate,
          `${rec.bsMonthName} ${rec.bsYear}`,
          rec.bsDay,
          rec.weekdayName,
          `Week ${rec.weekOfMonth}`,
          rec.className,
          sr.rollNumber,
          sr.name,
          sr.status === 'present' ? 'Present' : 'Absent',
        ]);
      }
    }
    const csv = buildCsvDocument(headers, rows);
    downloadTextFile(
      `attendance-${archiveClassObj.name.toLowerCase().replace(/\s+/g, '-')}-${archiveYear}-${monthName.toLowerCase()}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
  };

  if (activeRoster.length === 0 && activeTab === 'daily_register') {
    return (
      <div className="max-w-xl mx-auto p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-[var(--ink)]">
          No Active Students in {classRecord.name}
        </h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Add or import students into {classRecord.name} before marking daily attendance.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onAddStudentsShortcut}
            className="px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer"
          >
            Manage {classRecord.name} Roster
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('archive')}
            className="px-4 py-2.5 rounded-xl border border-[var(--border-hairline)] text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
          >
            Open Attendance Archive
          </button>
        </div>
      </div>
    );
  }

  const maxDaysInSelectedBsMonth = getBsMonthDays(
    selectedDateInfo.bsYear,
    selectedDateInfo.bsMonth
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-24">
      {/* Top Mode Switcher + Class Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-hairline)]">
        <div
          role="tablist"
          aria-label="Attendance views"
          className="inline-flex p-1 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] gap-1 self-start"
        >
          <button
            type="button"
            role="tab"
            data-testid="tab-daily-register"
            aria-selected={activeTab === 'daily_register'}
            onClick={() => setActiveTab('daily_register')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'daily_register'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Calendar className="w-4 h-4 text-[var(--accent)]" />
            Daily Register (BS)
          </button>
          <button
            type="button"
            role="tab"
            data-testid="tab-attendance-archive"
            aria-selected={activeTab === 'archive'}
            onClick={() => setActiveTab('archive')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'archive'
                ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Archive className="w-4 h-4 text-[var(--accent)]" />
            Attendance Archive ({dailyAttendanceRecords.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[var(--ink-muted)]">Class:</span>
          <div className="inline-flex flex-wrap gap-1">
            {activeClasses.map((cls) => {
              const isCurrent =
                activeTab === 'daily_register'
                  ? cls.id === classRecord.id
                  : cls.id === archiveClassObj.id;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => {
                    onSelectClass(cls.id);
                    setArchiveClassId(cls.id);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                    isCurrent
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--surface)] border border-[var(--border-hairline)] text-[var(--ink)] hover:bg-[var(--surface-subtle)]'
                  }`}
                >
                  {cls.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeTab === 'daily_register' ? (
        <>
          {/* Compact Bikram Sambat (BS) Date & Controls Bar */}
          <div
            data-testid="nepali-bs-date-banner"
            className="rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  data-testid="bs-current-date-heading"
                  className="text-lg sm:text-xl font-display font-bold text-[var(--ink)]"
                >
                  {selectedDateInfo.monthNameEn} {selectedDateInfo.bsDay}, {selectedDateInfo.bsYear} BS
                </h1>
                <span className="text-xs font-medium text-[var(--ink-muted)]">
                  ({selectedDateInfo.monthNameNp} · {selectedDateInfo.weekdayNameEn})
                </span>
                {nepaliPatroTodayBs && (
                  <span
                    data-testid="nepali-patro-verified-status"
                    className="px-2 py-0.5 rounded-md bg-[var(--sage-soft)] text-[var(--sage)] text-[11px] font-semibold"
                  >
                    Synced
                  </span>
                )}
              </div>

              <div
                data-testid="bs-date-metadata-line"
                className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[var(--ink-muted)]"
              >
                <span data-testid="attendance-autosave-status">
                  {lastSavedStatus ||
                    (existingRecordForDate
                      ? `${existingRecordForDate.presentCount} present · ${existingRecordForDate.absentCount} absent`
                      : `Week ${selectedDateInfo.weekOfMonth} · Auto-saved`)}
                </span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setArchiveYear(selectedDateInfo.bsYear);
                    setArchiveMonth(selectedDateInfo.bsMonth);
                    setArchiveClassId(classRecord.id);
                    setArchiveSelectedDate(selectedDateInfo.bsDateString);
                    setActiveTab('archive');
                  }}
                  className="font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  Monthly Archive →
                </button>
              </div>
            </div>

            {/* BS Date Navigation Controls */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="bs-prev-day-btn"
                onClick={() =>
                  setSelectedBsDate(stepNepaliDay(selectedDateInfo.bsDateString, -1).bsDateString)
                }
                aria-label="Previous Nepali day"
                className="p-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                title="Previous BS Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                aria-label="Select Bikram Sambat Year"
                value={selectedDateInfo.bsYear}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  const maxD = getBsMonthDays(y, selectedDateInfo.bsMonth);
                  const d = Math.min(selectedDateInfo.bsDay, maxD);
                  setSelectedBsDate(formatBsDateString(y, selectedDateInfo.bsMonth, d));
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs font-mono-tabular font-semibold text-[var(--ink)]"
              >
                {Array.from({ length: 15 }, (_, i) => todayBs.bsYear - 7 + i)
                  .filter((y) => y >= MIN_BS_YEAR && y <= MAX_BS_YEAR)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>

              <select
                aria-label="Select Nepali Month"
                value={selectedDateInfo.bsMonth}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  const maxD = getBsMonthDays(selectedDateInfo.bsYear, m);
                  const d = Math.min(selectedDateInfo.bsDay, maxD);
                  setSelectedBsDate(formatBsDateString(selectedDateInfo.bsYear, m, d));
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink)]"
              >
                {NEPALI_MONTH_NAMES_EN.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name} ({NEPALI_MONTH_NAMES_NP[idx]})
                  </option>
                ))}
              </select>

              <select
                aria-label="Select Nepali Day"
                value={selectedDateInfo.bsDay}
                onChange={(e) => {
                  const d = Number(e.target.value);
                  setSelectedBsDate(
                    formatBsDateString(selectedDateInfo.bsYear, selectedDateInfo.bsMonth, d)
                  );
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs font-mono-tabular font-semibold text-[var(--ink)]"
              >
                {Array.from({ length: maxDaysInSelectedBsMonth }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <button
                type="button"
                data-testid="bs-next-day-btn"
                onClick={() =>
                  setSelectedBsDate(stepNepaliDay(selectedDateInfo.bsDateString, 1).bsDateString)
                }
                aria-label="Next Nepali day"
                className="p-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                title="Next BS Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {!isSelectedDateToday && (
                <button
                  type="button"
                  data-testid="bs-today-btn"
                  onClick={() => setSelectedBsDate(todayBs.bsDateString)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Today
                </button>
              )}
            </div>
          </div>

          {/* Unified Compact Search & Roll Input Bar */}
          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1 flex gap-2">
                <Search className="w-4 h-4 text-[var(--ink-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="unified-attendance-input"
                  type="text"
                  value={unifiedInput}
                  onChange={(e) => {
                    setUnifiedInput(e.target.value);
                    if (!e.target.value.trim()) setRollFeedback(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && looksLikeRollBatch) {
                      e.preventDefault();
                      applyRollInput();
                    }
                  }}
                  placeholder="Search name or mark rolls absent (e.g. 502, 507)"
                  aria-label="Search student name or enter absent roll numbers"
                  className="flex-1 min-w-0 pl-9 pr-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm text-[var(--ink)]"
                />
                {looksLikeRollBatch && (
                  <button
                    type="button"
                    onClick={applyRollInput}
                    className="px-3.5 py-2 rounded-xl bg-[var(--surface-subtle)] hover:bg-[var(--accent-soft)] text-xs sm:text-sm font-semibold text-[var(--ink)] cursor-pointer whitespace-nowrap"
                  >
                    Mark Rolls Absent
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {absentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllPresent}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer whitespace-nowrap"
                    title="Reset everyone to Present"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    All Present
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowNoteInput((s) => !s)}
                  className={`p-2 rounded-xl border text-xs cursor-pointer ${
                    showNoteInput || notes
                      ? 'bg-[var(--accent-soft)] border-[var(--accent)]/40 text-[var(--accent)]'
                      : 'border-[var(--border-hairline)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  }`}
                  title="Add attendance note"
                  aria-label="Toggle session attendance note"
                >
                  <StickyNote className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showNoteInput && (
              <input
                id="attendance-notes"
                type="text"
                value={notes}
                onChange={(e) => {
                  const nextNotes = e.target.value;
                  setNotes(nextNotes);
                  void persistAttendanceUpdate(absentIds, nextNotes);
                }}
                placeholder="Optional daily attendance note (e.g. Morning lab check-in)"
                className="w-full px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-sm"
              />
            )}

            {rollFeedback && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pt-0.5">
                {rollFeedback.appliedCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[var(--sage)] font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Marked {rollFeedback.appliedCount} roll(s) absent
                  </span>
                )}
                {rollFeedback.duplicates.length > 0 && (
                  <span className="text-[var(--gold)] font-medium">
                    Duplicate roll(s) skipped: {rollFeedback.duplicates.join(', ')}
                  </span>
                )}
                {rollFeedback.unknown.length > 0 && (
                  <span
                    role="alert"
                    className="inline-flex items-center gap-1 text-[var(--crimson)] font-semibold"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Unknown roll number(s) in {classRecord.name}: {rollFeedback.unknown.join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Inline Guard if Zero Students Present */}
          {allAbsent && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-[var(--crimson-soft)] border border-[var(--crimson)]/35 flex items-center justify-between gap-3 text-sm text-[var(--crimson)]"
            >
              <span className="flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                All students are marked absent. Tap at least one student to keep them present before launching an activity.
              </span>
              <button
                type="button"
                onClick={handleResetAllPresent}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink)] cursor-pointer shrink-0"
              >
                Mark All Present
              </button>
            </div>
          )}

          {/* Naturally Sorted Tap-First Roll Matrix */}
          <div
            data-testid="daily-attendance-student-grid"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5"
          >
            {filteredRoster.map((student) => {
              const isAbsent = absentSet.has(student.id);
              return (
                <button
                  key={student.id}
                  type="button"
                  data-testid={`attendance-student-tile-${student.rollNumber}`}
                  onClick={() => toggleAbsent(student.id)}
                  aria-pressed={isAbsent}
                  className={`group p-3 rounded-2xl border text-left flex items-center justify-between gap-2 cursor-pointer transition-all min-h-[54px] ${
                    isAbsent
                      ? 'bg-[var(--surface-subtle)] border-[var(--ink)]/20 opacity-85'
                      : 'bg-[var(--surface)] border-[var(--border-hairline)] hover:border-[var(--accent)]/55'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono-tabular text-[var(--ink-muted)]">
                      Roll {student.rollNumber}
                    </div>
                    <div
                      className={`text-sm font-semibold truncate ${
                        isAbsent ? 'line-through text-[var(--ink-muted)]' : 'text-[var(--ink)]'
                      }`}
                    >
                      {student.name}
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold shrink-0 ${
                      isAbsent
                        ? 'bg-[var(--canvas)] text-[var(--crimson)] border border-[var(--crimson)]/25'
                        : 'bg-[var(--sage-soft)] text-[var(--sage)]'
                    }`}
                  >
                    {isAbsent ? (
                      <>
                        <UserMinus className="w-3 h-3" />
                        Absent
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3" />
                        Present
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sticky Live Summary & Continue Bar */}
          <div className="fixed bottom-16 md:bottom-4 [@media(max-height:480px)]:bottom-2 inset-x-3 sm:inset-x-6 md:left-60 z-20 pointer-events-none">
            <div
              style={{ boxShadow: 'var(--shadow-elevated)' }}
              className="max-w-5xl mx-auto pointer-events-auto rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-mono-tabular">
                <span className="font-semibold text-[var(--ink)] font-sans">
                  {selectedDateInfo.monthNameEn} {selectedDateInfo.bsDay}, {selectedDateInfo.bsYear}
                </span>
                <span className="text-[var(--ink-muted)]" aria-hidden="true">
                  ·
                </span>
                <span className="font-semibold text-[var(--sage)]">{presentCount} Present</span>
                <span className="text-[var(--ink-muted)]" aria-hidden="true">
                  ·
                </span>
                <span
                  className={
                    absentIds.length > 0
                      ? 'font-semibold text-[var(--crimson)]'
                      : 'text-[var(--ink-muted)]'
                  }
                >
                  {absentIds.length} Absent
                </span>
              </div>

              <div className="flex items-center gap-2">
                {!isSelectedDateToday && (
                  <button
                    type="button"
                    onClick={() => void persistAttendanceUpdate(absentIds, notes)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs sm:text-sm font-semibold text-white cursor-pointer whitespace-nowrap"
                  >
                    <Check className="w-4 h-4" />
                    Save {selectedDateInfo.monthNameEn} {selectedDateInfo.bsDay} Record
                  </button>
                )}

                {isSelectedDateToday && (
                  <button
                    type="button"
                    data-testid="confirm-attendance-btn"
                    disabled={allAbsent || saving}
                    onClick={handleConfirmNow}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-sm font-semibold text-white cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {saving
                      ? 'Saving...'
                      : isEditingExistingSession
                        ? 'Save Attendance'
                        : 'Continue to Activities'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* IN-APP ATTENDANCE ARCHIVE: Attendance -> Nepali Month -> Class -> Date -> Student Records */
        <div data-testid="attendance-archive-view" className="space-y-5">
          {/* Hierarchy Header & Nepali Month Controls */}
          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-[var(--accent)]">
                  Attendance → Nepali Month → Class → Date → Student Records
                </div>
                <h1 className="text-xl sm:text-2xl font-display font-bold text-[var(--ink)] mt-0.5">
                  {NEPALI_MONTH_NAMES_EN[archiveMonth - 1]} ({NEPALI_MONTH_NAMES_NP[archiveMonth - 1]}){' '}
                  {archiveYear} BS · {archiveClassObj.name}
                </h1>
                <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                  {monthClassRecords.length} recorded school{' '}
                  {monthClassRecords.length === 1 ? 'day' : 'days'} in this Nepali month for{' '}
                  {archiveClassObj.name}. Click any date below to inspect or edit student attendance.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const prev = stepNepaliMonth(archiveYear, archiveMonth, -1);
                    setArchiveYear(prev.bsYear);
                    setArchiveMonth(prev.bsMonth);
                  }}
                  aria-label="Previous Nepali month"
                  className="p-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <select
                  aria-label="Archive Bikram Sambat Year"
                  value={archiveYear}
                  onChange={(e) => setArchiveYear(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs sm:text-sm font-mono-tabular font-semibold text-[var(--ink)]"
                >
                  {Array.from({ length: 15 }, (_, i) => todayBs.bsYear - 7 + i)
                    .filter((y) => y >= MIN_BS_YEAR && y <= MAX_BS_YEAR)
                    .map((y) => (
                      <option key={y} value={y}>
                        {y} BS
                      </option>
                    ))}
                </select>

                <select
                  aria-label="Archive Nepali Month"
                  value={archiveMonth}
                  onChange={(e) => setArchiveMonth(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-xs sm:text-sm font-semibold text-[var(--ink)]"
                >
                  {NEPALI_MONTH_NAMES_EN.map((mName, idx) => (
                    <option key={mName} value={idx + 1}>
                      {idx + 1}. {mName} ({NEPALI_MONTH_NAMES_NP[idx]})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const next = stepNepaliMonth(archiveYear, archiveMonth, 1);
                    setArchiveYear(next.bsYear);
                    setArchiveMonth(next.bsMonth);
                  }}
                  aria-label="Next Nepali month"
                  className="p-2 rounded-lg bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {monthClassRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportMonthlyCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--accent-soft)] text-xs font-semibold text-[var(--ink)] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Month CSV
                  </button>
                )}
              </div>
            </div>

            {/* Quick Recorded Nepali Months Switcher */}
            {groupedArchive.length > 0 && (
              <div className="pt-3 border-t border-[var(--border-hairline)] flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-[var(--ink-muted)] mr-1">
                  Months with Records:
                </span>
                {groupedArchive.map((mg) => {
                  const isCurrentMonth =
                    mg.bsYear === archiveYear && mg.bsMonth === archiveMonth;
                  return (
                    <button
                      key={mg.bsMonthKey}
                      type="button"
                      onClick={() => {
                        setArchiveYear(mg.bsYear);
                        setArchiveMonth(mg.bsMonth);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        isCurrentMonth
                          ? 'bg-[var(--accent)] text-white font-semibold'
                          : 'bg-[var(--canvas)] border border-[var(--border-hairline)] text-[var(--ink)] hover:bg-[var(--surface-subtle)]'
                      }`}
                    >
                      {mg.bsMonthNameEn} {mg.bsYear} ({mg.totalRecords})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Two-Column Archive Workspace: Left = BS Month Calendar & Recorded Dates | Right = Selected Date Student Records */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column (5 cols): BS Month Calendar Grid + Recorded Dates List */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-display font-bold text-[var(--ink)]">
                    {archiveMonthCalendar.monthNameEn} {archiveYear} BS Calendar
                  </h2>
                  <span className="text-xs font-mono-tabular text-[var(--ink-muted)]">
                    {archiveMonthCalendar.daysInMonth} days · {archiveMonthCalendar.totalWeeks} weeks
                  </span>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[var(--ink-muted)]">
                  {WEEKDAY_SHORT_EN.map((w) => (
                    <div key={w} className="py-1">
                      {w}
                    </div>
                  ))}
                </div>

                {/* BS Month Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: archiveMonthCalendar.firstWeekdayIndex }, (_, i) => (
                    <div key={`empty-${i}`} className="h-11" />
                  ))}
                  {archiveMonthCalendar.days.map((dInfo) => {
                    const rec = monthClassRecordByDate.get(dInfo.bsDateString);
                    const isSelected = dInfo.bsDateString === archiveSelectedDate;
                    const isToday = dInfo.bsDateString === todayBs.bsDateString;

                    return (
                      <button
                        key={dInfo.bsDateString}
                        type="button"
                        onClick={() => setArchiveSelectedDate(dInfo.bsDateString)}
                        data-testid={`archive-calendar-day-${dInfo.bsDateString}`}
                        className={`h-11 rounded-lg border p-1 flex flex-col items-center justify-between text-xs font-mono-tabular cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-bold'
                            : rec
                              ? 'bg-[var(--sage-soft)] border-[var(--sage)]/40 text-[var(--ink)] font-semibold'
                              : isToday
                                ? 'bg-[var(--accent-soft)] border-[var(--accent)]/40 text-[var(--ink)] font-semibold'
                                : 'bg-[var(--canvas)] border-[var(--border-hairline)] text-[var(--ink)] hover:bg-[var(--surface-subtle)]'
                        }`}
                      >
                        <span>{dInfo.bsDay}</span>
                        {rec ? (
                          <span
                            className={`text-[9px] leading-none ${
                              isSelected ? 'text-white/90' : 'text-[var(--sage)]'
                            }`}
                          >
                            {rec.presentCount}P/{rec.absentCount}A
                          </span>
                        ) : isToday ? (
                          <span
                            className={`text-[9px] leading-none ${
                              isSelected ? 'text-white/90' : 'text-[var(--accent)]'
                            }`}
                          >
                            Today
                          </span>
                        ) : (
                          <span className="text-[9px] leading-none opacity-40">·</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recorded Dates List inside this Nepali Month & Class */}
              <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-4 space-y-2.5">
                <h2 className="text-sm font-display font-bold text-[var(--ink)]">
                  Recorded Dates in {archiveMonthCalendar.monthNameEn} ({monthClassRecords.length})
                </h2>
                {monthClassRecords.length === 0 ? (
                  <p className="text-xs text-[var(--ink-muted)] py-2">
                    No attendance records saved yet for {archiveClassObj.name} in{' '}
                    {archiveMonthCalendar.monthNameEn} {archiveYear} BS. Select any date on the
                    calendar above to mark or save attendance.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {monthClassRecords.map((rec) => {
                      const active = rec.bsDate === archiveSelectedDate;
                      return (
                        <button
                          key={rec.id}
                          type="button"
                          onClick={() => setArchiveSelectedDate(rec.bsDate)}
                          className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            active
                              ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--ink)]'
                              : 'bg-[var(--surface-subtle)] border-[var(--border-hairline)] hover:bg-[var(--canvas)]'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-semibold text-[var(--ink)]">
                              {rec.bsMonthName} {rec.bsDay}, {rec.bsYear} BS · {rec.weekdayName}
                            </div>
                            <div className="text-[11px] font-mono-tabular text-[var(--ink-muted)]">
                              Week {rec.weekOfMonth} · AD {rec.adDate}
                              {rec.notes ? ` · ${rec.notes}` : ''}
                            </div>
                          </div>
                          <div className="text-xs font-mono-tabular font-semibold shrink-0">
                            <span className="text-[var(--sage)]">{rec.presentCount}P</span>
                            <span className="text-[var(--ink-muted)]"> · </span>
                            <span className="text-[var(--crimson)]">{rec.absentCount}A</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (7 cols): Date -> Student Records Inspector & Editor */}
            <div className="lg:col-span-7 space-y-4">
              <div
                data-testid="archive-date-student-records"
                className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-hairline)]">
                  <div>
                    <div className="text-xs font-semibold text-[var(--accent)]">
                      {archiveClassObj.name} · {selectedArchiveDateInfo.monthNameEn}{' '}
                      {selectedArchiveDateInfo.bsDay}, {selectedArchiveDateInfo.bsYear} BS
                    </div>
                    <h2 className="text-lg font-display font-bold text-[var(--ink)]">
                      {selectedArchiveDateInfo.weekdayNameEn} · Week{' '}
                      {selectedArchiveDateInfo.weekOfMonth} Student Records
                    </h2>
                    <div className="text-xs font-mono-tabular text-[var(--ink-muted)] mt-0.5">
                      {selectedArchiveDateRecord ? (
                        <>
                          <span className="text-[var(--sage)] font-semibold">
                            {selectedArchiveDateRecord.presentCount} Present
                          </span>
                          {' · '}
                          <span className="text-[var(--crimson)] font-semibold">
                            {selectedArchiveDateRecord.absentCount} Absent
                          </span>
                          {' · '}
                          <span>
                            Updated{' '}
                            {new Date(selectedArchiveDateRecord.updatedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </>
                      ) : (
                        <span>
                          Not yet recorded for this date — tap any student or "Record All Present"
                          below to save.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!selectedArchiveDateRecord && archiveClassRoster.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleRecordAllPresentInArchiveDate()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-xs font-semibold text-white cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Record All Present
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onSelectClass(archiveClassObj.id);
                        setSelectedBsDate(selectedArchiveDateInfo.bsDateString);
                        setActiveTab('daily_register');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Open in Daily Register
                    </button>
                  </div>
                </div>

                {/* Student Records List for Selected Date (Tap to Toggle Present / Absent) */}
                {archiveClassRoster.length === 0 ? (
                  <p className="text-sm text-[var(--ink-muted)] py-4">
                    No active students in {archiveClassObj.name}.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[var(--surface-subtle)] text-xs text-[var(--ink-muted)]">
                        <tr>
                          <th className="py-2 px-3">Roll Number</th>
                          <th className="py-2 px-3">Student Name</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3 text-right">Quick Edit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-hairline)]">
                        {(selectedArchiveDateRecord
                          ? selectedArchiveDateRecord.studentRecords
                          : archiveClassRoster.map((s) => ({
                              studentId: s.id,
                              name: s.name,
                              rollNumber: s.rollNumber,
                              status: 'present' as const,
                            }))
                        ).map((sr) => {
                          const isAbsent = sr.status === 'absent';
                          return (
                            <tr key={sr.studentId}>
                              <td className="py-2.5 px-3 font-mono-tabular font-medium">
                                {sr.rollNumber}
                              </td>
                              <td
                                className={`py-2.5 px-3 font-medium ${
                                  isAbsent
                                    ? 'line-through text-[var(--ink-muted)]'
                                    : 'text-[var(--ink)]'
                                }`}
                              >
                                {sr.name}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                                    isAbsent
                                      ? 'bg-[var(--crimson-soft)] text-[var(--crimson)]'
                                      : 'bg-[var(--sage-soft)] text-[var(--sage)]'
                                  }`}
                                >
                                  {isAbsent ? 'Absent' : 'Present'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => void handleToggleArchiveStudentStatus(sr.studentId)}
                                  className="px-2.5 py-1 rounded-lg border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
                                >
                                  Mark {isAbsent ? 'Present' : 'Absent'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Monthly Class Attendance Summary Table */}
              <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-display font-bold text-[var(--ink)]">
                    {archiveMonthCalendar.monthNameEn} {archiveYear} BS Monthly Totals ·{' '}
                    {archiveClassObj.name}
                  </h2>
                  <span className="text-xs font-mono-tabular text-[var(--ink-muted)]">
                    {monthClassRecords.length} days recorded
                  </span>
                </div>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[var(--surface-subtle)] text-xs text-[var(--ink-muted)] sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Roll</th>
                        <th className="py-2 px-3">Student</th>
                        <th className="py-2 px-3">Present</th>
                        <th className="py-2 px-3">Absent</th>
                        <th className="py-2 px-3">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-hairline)]">
                      {monthlyStudentTallies.map((row) => (
                        <tr key={row.student.id}>
                          <td className="py-2 px-3 font-mono-tabular">{row.student.rollNumber}</td>
                          <td className="py-2 px-3 font-medium text-[var(--ink)]">
                            {row.student.name}
                          </td>
                          <td className="py-2 px-3 font-mono-tabular text-[var(--sage)] font-semibold">
                            {row.daysPresent}
                          </td>
                          <td className="py-2 px-3 font-mono-tabular text-[var(--crimson)] font-semibold">
                            {row.daysAbsent}
                          </td>
                          <td className="py-2 px-3 font-mono-tabular">
                            {row.pct !== null ? `${row.pct}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
