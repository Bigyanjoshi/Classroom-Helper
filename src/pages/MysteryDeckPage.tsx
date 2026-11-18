import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  HelpCircle,
  Layers,
  Maximize2,
  Minimize2,
  RotateCcw,
  Shuffle,
  Sparkles,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import {
  computeDeckPagination,
  computeLastRowShiftPx,
  computeOptimalDeckGrid,
} from '../domain/deckLayout';
import {
  cancelPendingReveal,
  computeRemainingSpotlightHoldMs,
  confirmPendingReveal,
  reshuffleRemainingSlots,
  revealDeckSlot,
  SPOTLIGHT_FLY_MS,
  SPOTLIGHT_HOLD_MS,
  SPOTLIGHT_LIFT_MS,
  undoLastSelection,
} from '../domain/deckStateMachine';
import {
  computeFairnessWeights,
  createDeckSlots,
  filterHistoryByScope,
  getActivityDisplayLabel,
} from '../domain/eligibility';
import { secureRandomInt, SecureRandomUnavailableError } from '../domain/random';
import type {
  ActivityRecord,
  ActivitySelection,
  AppSettings,
  ClassRecord,
  ClassSession,
  QuestionItem,
  RewardChallengeItem,
  Student,
} from '../domain/types';
import {
  type BoxRect,
  type CinematicRevealPhase,
  CinematicRevealOverlay,
} from '../components/CinematicRevealOverlay';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MysteryFlipCard } from '../components/StudentCard';
import { StudentAvatar } from '../components/StudentAvatar';
import { buildCsvDocument, downloadTextFile } from '../services/exportService';
import { playSoundEffect, triggerHapticFeedback } from '../services/soundService';

function toBoxRect(rect: DOMRect): BoxRect {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

interface MysteryDeckPageProps {
  activity: ActivityRecord;
  classRecord: ClassRecord;
  session: ClassSession;
  students: Student[];
  selections: ActivitySelection[];
  recentSessionIds: string[];
  questions: QuestionItem[];
  rewards: RewardChallengeItem[];
  settings: AppSettings;
  questionSubject?: string;
  onUpdateActivity: (next: ActivityRecord) => Promise<void>;
  onRecordSelection: (selection: Omit<ActivitySelection, 'id'>) => Promise<void>;
  onMarkLastSelectionUndone: (activityId: string, studentId: string) => Promise<void>;
  onResetActivitySelectionsInDb: (activityId: string) => Promise<void>;
  onStartNewRound: () => Promise<void>;
  onChooseAnotherActivity: () => void;
  onReturnToClassOverview: () => void;
}

export const MysteryDeckPage: React.FC<MysteryDeckPageProps> = ({
  activity,
  classRecord,
  session,
  students,
  selections,
  recentSessionIds,
  questions,
  rewards,
  settings,
  questionSubject = 'all',
  onUpdateActivity,
  onRecordSelection,
  onMarkLastSelectionUndone,
  onResetActivitySelectionsInDb,
  onStartNewRound,
  onChooseAnotherActivity,
  onReturnToClassOverview,
}) => {
  const [isShuffling, setIsShuffling] = useState(false);
  const [pendingWarning, setPendingWarning] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [projectorMode, setProjectorMode] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'reset_shuffle' | 'reset_round' | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [completionBannerDismissed, setCompletionBannerDismissed] = useState(false);
  const [completedStageView, setCompletedStageView] = useState<'selected_review' | 'deck'>(
    'selected_review'
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );
  const [spotlight, setSpotlight] = useState<{
    slotIndex: number;
    studentId: string;
    cardBackVariant: number;
    phase: Exclude<CinematicRevealPhase, 'idle'>;
    holdDurationMs: number;
    sourceRect: BoxRect | null;
    targetRect: BoxRect | null;
  } | null>(null);

  const deckStageRef = useRef<HTMLDivElement | null>(null);
  const selectedTargetRef = useRef<HTMLElement | null>(null);
  const selectedListScrollRef = useRef<HTMLDivElement | null>(null);
  const transitionLockRef = useRef(false);
  const cancelInFlightRef = useRef(false);
  const isConfirmingRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const rafIdsRef = useRef<number[]>([]);
  const cardCellRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const prevCardRectsRef = useRef<
    Map<number, { left: number; top: number; width: number; height: number }>
  >(new Map());
  const flipRafRef = useRef<number | null>(null);
  const flipCleanupTimerRef = useRef<number | null>(null);

  const activityRef = useRef(activity);
  activityRef.current = activity;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const rewardsRef = useRef(rewards);
  rewardsRef.current = rewards;
  const questionSubjectRef = useRef(questionSubject);
  questionSubjectRef.current = questionSubject;

  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [viewport, setViewport] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));

  const effectiveReduceMotion = settings.reduceMotion || prefersReducedMotion;
  const effectiveReduceMotionRef = useRef(effectiveReduceMotion);
  effectiveReduceMotionRef.current = effectiveReduceMotion;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  useEffect(() => {
    const el = deckStageRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const nextW = Math.floor(rect.width);
      const nextH = Math.floor(rect.height);
      setStageSize((prev) =>
        Math.abs(prev.width - nextW) > 1 || Math.abs(prev.height - nextH) > 1
          ? { width: nextW, height: nextH }
          : prev
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [activity.status, projectorMode, viewport.width, viewport.height]);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const absentSet = useMemo(() => new Set(session.absentStudentIds), [session.absentStudentIds]);

  const eligibleStudents = useMemo(
    () =>
      students.filter(
        (s) =>
          s.classId === classRecord.id &&
          s.activeStatus === 'active' &&
          !absentSet.has(s.id)
      ),
    [students, classRecord.id, absentSet]
  );

  const fairnessWeights = useMemo(() => {
    const scoped = filterHistoryByScope(
      selections,
      classRecord.id,
      activity.fairnessScope,
      session.id,
      recentSessionIds
    );
    return computeFairnessWeights(eligibleStudents, scoped, activity.selectionMode);
  }, [
    selections,
    classRecord.id,
    activity.fairnessScope,
    session.id,
    recentSessionIds,
    eligibleStudents,
    activity.selectionMode,
  ]);

  const pendingSlot = activity.deckSlots.find((s) => s.state === 'pending_reveal') ?? null;
  const activeDeckSlots = useMemo(
    () => activity.deckSlots.filter((s) => s.state !== 'empty'),
    [activity.deckSlots]
  );
  const hiddenCount = activeDeckSlots.filter((s) => s.state === 'hidden').length;
  const selectedStudents = activity.selectedStudentIds
    .map((id) => studentMap.get(id))
    .filter((s): s is Student => Boolean(s));

  const latestQuestionAssignment =
    activity.questionAssignments && activity.questionAssignments.length > 0
      ? activity.questionAssignments[activity.questionAssignments.length - 1]
      : null;

  const latestRewardAssignment =
    activity.rewardAssignments && activity.rewardAssignments.length > 0
      ? activity.rewardAssignments[activity.rewardAssignments.length - 1]
      : null;

  const questionByStudentId = useMemo(() => {
    const map = new Map<string, NonNullable<ActivityRecord['questionAssignments']>[number]>();
    for (const qa of activity.questionAssignments ?? []) {
      map.set(qa.studentId, qa);
    }
    return map;
  }, [activity.questionAssignments]);

  const rewardByStudentId = useMemo(() => {
    const map = new Map<string, NonNullable<ActivityRecord['rewardAssignments']>[number]>();
    for (const ra of activity.rewardAssignments ?? []) {
      map.set(ra.studentId, ra);
    }
    return map;
  }, [activity.rewardAssignments]);

  useEffect(() => {
    if (activity.status !== 'completed') {
      setCompletionBannerDismissed(false);
      setCompletedStageView('selected_review');
    }
  }, [activity.id, activity.status]);

  // Smoothly scroll Selected Students list to latest pick when count increases
  const prevSelectedCountRef = useRef(selectedStudents.length);
  useEffect(() => {
    if (selectedStudents.length > prevSelectedCountRef.current) {
      const listEl = selectedListScrollRef.current;
      if (listEl) {
        listEl.scrollTop = listEl.scrollHeight;
      }
    }
    prevSelectedCountRef.current = selectedStudents.length;
  }, [selectedStudents.length]);

  const isLandscapeMobile = viewport.width > viewport.height && viewport.height <= 540;
  const isSidePanelLayout =
    viewport.width >= 1024 || (viewport.width > viewport.height && viewport.width >= 560);

  const paginationPlan = useMemo(
    () => computeDeckPagination(activeDeckSlots.length, stageSize.width, stageSize.height),
    [activeDeckSlots.length, stageSize.width, stageSize.height]
  );

  const clampedPage = Math.max(0, Math.min(paginationPlan.totalPages - 1, currentPage));
  useEffect(() => {
    if (clampedPage !== currentPage) {
      setCurrentPage(clampedPage);
    }
  }, [clampedPage, currentPage]);

  // If a pending slot exists on a different page after resize, keep it visible
  useEffect(() => {
    if (!pendingSlot || !paginationPlan.needsPagination) return;
    const idx = activeDeckSlots.findIndex((s) => s.slotIndex === pendingSlot.slotIndex);
    if (idx >= 0) {
      const targetPage = Math.floor(idx / paginationPlan.pageSize);
      if (targetPage !== clampedPage) {
        setCurrentPage(targetPage);
      }
    }
  }, [
    pendingSlot,
    paginationPlan.needsPagination,
    paginationPlan.pageSize,
    activeDeckSlots,
    clampedPage,
  ]);

  const visibleSlots = useMemo(() => {
    if (!paginationPlan.needsPagination) return activeDeckSlots;
    const start = clampedPage * paginationPlan.pageSize;
    return activeDeckSlots.slice(start, start + paginationPlan.pageSize);
  }, [activeDeckSlots, paginationPlan.needsPagination, paginationPlan.pageSize, clampedPage]);

  const displayGrid = useMemo(() => {
    if (
      paginationPlan.needsPagination &&
      visibleSlots.length > 0 &&
      visibleSlots.length < paginationPlan.pageSize
    ) {
      return computeOptimalDeckGrid(visibleSlots.length, stageSize.width, stageSize.height);
    }
    return paginationPlan.grid;
  }, [paginationPlan, visibleSlots.length, stageSize.width, stageSize.height]);

  const hapticsOn = settings.hapticsEnabled ?? true;

  const clearRevealTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    rafIdsRef.current.forEach((id) => window.cancelAnimationFrame(id));
    rafIdsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearRevealTimers();
      if (flipRafRef.current !== null) {
        window.cancelAnimationFrame(flipRafRef.current);
        flipRafRef.current = null;
      }
      if (flipCleanupTimerRef.current !== null) {
        window.clearTimeout(flipCleanupTimerRef.current);
        flipCleanupTimerRef.current = null;
      }
      transitionLockRef.current = false;
      isConfirmingRef.current = false;
    };
  }, [clearRevealTimers]);

  // Smooth GPU-composited FLIP animation whenever remaining cards resize or rearrange
  useLayoutEffect(() => {
    const stageEl = deckStageRef.current;
    if (!stageEl || activity.status !== 'in_progress') {
      prevCardRectsRef.current.clear();
      return;
    }

    if (flipRafRef.current !== null) {
      window.cancelAnimationFrame(flipRafRef.current);
      flipRafRef.current = null;
    }
    if (flipCleanupTimerRef.current !== null) {
      window.clearTimeout(flipCleanupTimerRef.current);
      flipCleanupTimerRef.current = null;
    }

    const activeEls: Array<{ slotIndex: number; el: HTMLDivElement }> = [];
    visibleSlots.forEach((slot) => {
      const el = cardCellRefs.current.get(slot.slotIndex);
      if (el) {
        el.style.transition = 'none';
        el.style.transform = '';
        el.style.transformOrigin = 'top left';
        el.style.willChange = '';
        el.style.opacity = '';
        activeEls.push({ slotIndex: slot.slotIndex, el });
      }
    });

    const stageRect = stageEl.getBoundingClientRect();
    const nextRects = new Map<
      number,
      { left: number; top: number; width: number; height: number }
    >();

    for (const { slotIndex, el } of activeEls) {
      const r = el.getBoundingClientRect();
      nextRects.set(slotIndex, {
        left: r.left - stageRect.left,
        top: r.top - stageRect.top,
        width: r.width,
        height: r.height,
      });
    }

    const prevRects = prevCardRectsRef.current;
    const shouldAnimate = !effectiveReduceMotion && prevRects.size > 0;
    const animatedEls: HTMLDivElement[] = [];

    if (shouldAnimate) {
      for (const { slotIndex, el } of activeEls) {
        const prev = prevRects.get(slotIndex);
        const next = nextRects.get(slotIndex);
        if (!next) continue;

        if (prev) {
          const dx = prev.left - next.left;
          const dy = prev.top - next.top;
          const sx = next.width > 0 ? prev.width / next.width : 1;
          const sy = next.height > 0 ? prev.height / next.height : 1;
          if (
            Math.abs(dx) > 0.8 ||
            Math.abs(dy) > 0.8 ||
            Math.abs(sx - 1) > 0.015 ||
            Math.abs(sy - 1) > 0.015
          ) {
            el.style.willChange = 'transform';
            el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
            animatedEls.push(el);
          }
        } else {
          el.style.willChange = 'transform, opacity';
          el.style.opacity = '0.6';
          el.style.transform = 'scale(0.88)';
          animatedEls.push(el);
        }
      }

      if (animatedEls.length > 0) {
        void stageEl.offsetWidth;
        flipRafRef.current = window.requestAnimationFrame(() => {
          flipRafRef.current = null;
          for (const el of animatedEls) {
            el.style.transition =
              'transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease-out';
            el.style.transform = 'translate3d(0px, 0px, 0) scale(1, 1)';
            el.style.opacity = '1';
          }
          flipCleanupTimerRef.current = window.setTimeout(() => {
            flipCleanupTimerRef.current = null;
            for (const el of animatedEls) {
              el.style.transition = '';
              el.style.transform = '';
              el.style.transformOrigin = '';
              el.style.willChange = '';
              el.style.opacity = '';
            }
          }, 390);
        });
      }
    }

    prevCardRectsRef.current = nextRects;
  }, [
    activity.status,
    effectiveReduceMotion,
    visibleSlots,
    displayGrid.cols,
    displayGrid.rows,
    displayGrid.cardW,
    displayGrid.cardH,
    displayGrid.gap,
    stageSize.width,
    stageSize.height,
  ]);

  const finalizeAutoConfirm = useCallback(async () => {
    if (isConfirmingRef.current) return;
    isConfirmingRef.current = true;
    const currentAct = activityRef.current;
    const currentSettings = settingsRef.current;
    const outcome = confirmPendingReveal(currentAct, Date.now());

    if (!outcome.ok || !outcome.confirmedStudentId) {
      if (outcome.reason === 'duplicate_in_pair') {
        setPendingWarning(
          'This student is already first in the pair. Card returned to the deck.'
        );
        const reverted = cancelPendingReveal(currentAct.deckSlots);
        await onUpdateActivity({
          ...currentAct,
          deckSlots: reverted,
          pendingRevealedAt: undefined,
        });
      }
      setSpotlight(null);
      transitionLockRef.current = false;
      isConfirmingRef.current = false;
      return;
    }

    let nextActivity = outcome.activity;
    const confirmedId = outcome.confirmedStudentId;
    let assignedQuestion: QuestionItem | undefined;
    let assignedReward: RewardChallengeItem | undefined;

    try {
      const qList = questionsRef.current;
      const qSubject = questionSubjectRef.current;
      if (currentAct.type === 'student_question') {
        const pool =
          qSubject === 'all' ? qList : qList.filter((q) => q.subject === qSubject);
        const activePool = pool.length > 0 ? pool : qList;
        if (activePool.length > 0) {
          assignedQuestion = activePool[secureRandomInt(activePool.length)];
          nextActivity = {
            ...nextActivity,
            questionAssignments: [
              ...(nextActivity.questionAssignments ?? []),
              {
                studentId: confirmedId,
                questionId: assignedQuestion.id,
                questionText: assignedQuestion.text,
                subject: assignedQuestion.subject,
                revealed: false,
              },
            ],
          };
        }
      }

      const rList = rewardsRef.current;
      if (currentAct.type === 'mystery_reward' && rList.length > 0) {
        const rewardPool = rList.filter((r) => r.kind !== 'duty');
        const pool = rewardPool.length > 0 ? rewardPool : rList;
        assignedReward = pool[secureRandomInt(pool.length)];
        nextActivity = {
          ...nextActivity,
          rewardAssignments: [
            ...(nextActivity.rewardAssignments ?? []),
            {
              studentId: confirmedId,
              rewardText: assignedReward.text,
              revealed: false,
            },
          ],
        };
      }
    } catch (err) {
      setPendingWarning(
        err instanceof SecureRandomUnavailableError
          ? err.message
          : 'Secure randomness failed while assigning a prompt.'
      );
      setSpotlight(null);
      transitionLockRef.current = false;
      isConfirmingRef.current = false;
      return;
    }

    try {
      const cue = nextActivity.status === 'completed' ? 'complete' : 'confirm';
      const currentHaptics = currentSettings.hapticsEnabled ?? true;
      playSoundEffect(cue, currentSettings.soundEnabled);
      triggerHapticFeedback(cue, currentHaptics);

      await onUpdateActivity(nextActivity);
      await onRecordSelection({
        activityId: currentAct.id,
        sessionId: session.id,
        classId: classRecord.id,
        studentId: confirmedId,
        selectionOrder: nextActivity.selectedStudentIds.length,
        selectedAt: Date.now(),
        pairId: currentAct.type === 'two_toss' ? currentAct.id : undefined,
        questionId: assignedQuestion?.id,
        questionText: assignedQuestion?.text,
        dutyTitle: currentAct.type === 'lucky_picker' ? currentAct.dutyTitle : undefined,
        rewardText: assignedReward?.text,
      });
    } finally {
      setSpotlight(null);
      transitionLockRef.current = false;
      isConfirmingRef.current = false;
    }
  }, [classRecord.id, onRecordSelection, onUpdateActivity, session.id]);

  const startSpotlightSequence = useCallback(
    (params: {
      slotIndex: number;
      studentId: string;
      cardBackVariant: number;
      holdDurationMs: number;
      sourceRect: BoxRect | null;
      skipLift: boolean;
    }) => {
      clearRevealTimers();

      const scheduleHoldAndFly = (holdMs: number) => {
        const holdTimer = window.setTimeout(() => {
          const targetEl = selectedTargetRef.current;
          const targetRect = targetEl ? toBoxRect(targetEl.getBoundingClientRect()) : null;
          if (effectiveReduceMotionRef.current || !targetRect) {
            void finalizeAutoConfirm();
            return;
          }
          setSpotlight((prev) =>
            prev ? { ...prev, phase: 'flying_to_panel', targetRect } : null
          );
          const flyTimer = window.setTimeout(() => {
            void finalizeAutoConfirm();
          }, SPOTLIGHT_FLY_MS);
          timersRef.current.push(flyTimer);
        }, holdMs);
        timersRef.current.push(holdTimer);
      };

      if (params.skipLift || effectiveReduceMotionRef.current || !params.sourceRect) {
        setSpotlight({
          slotIndex: params.slotIndex,
          studentId: params.studentId,
          cardBackVariant: params.cardBackVariant,
          phase: 'spotlight',
          holdDurationMs: params.holdDurationMs,
          sourceRect: params.sourceRect,
          targetRect: null,
        });
        scheduleHoldAndFly(params.holdDurationMs);
        return;
      }

      setSpotlight({
        slotIndex: params.slotIndex,
        studentId: params.studentId,
        cardBackVariant: params.cardBackVariant,
        phase: 'lift_start',
        holdDurationMs: params.holdDurationMs,
        sourceRect: params.sourceRect,
        targetRect: null,
      });

      const raf1 = window.requestAnimationFrame(() => {
        const raf2 = window.requestAnimationFrame(() => {
          setSpotlight((prev) => (prev ? { ...prev, phase: 'lifting' } : null));
          const liftTimer = window.setTimeout(() => {
            setSpotlight((prev) => (prev ? { ...prev, phase: 'spotlight' } : null));
            scheduleHoldAndFly(params.holdDurationMs);
          }, SPOTLIGHT_LIFT_MS);
          timersRef.current.push(liftTimer);
        });
        rafIdsRef.current.push(raf2);
      });
      rafIdsRef.current.push(raf1);
    },
    [clearRevealTimers, finalizeAutoConfirm]
  );

  // Refresh recovery: if a `pending_reveal` slot exists in IndexedDB on load,
  // resume its exact spotlight reveal & Cancel / auto-confirm lifecycle without re-picking.
  useEffect(() => {
    if (
      activity.status !== 'in_progress' ||
      !pendingSlot ||
      !pendingSlot.studentId ||
      transitionLockRef.current ||
      cancelInFlightRef.current ||
      isConfirmingRef.current
    ) {
      return;
    }
    if (
      spotlight !== null &&
      (timersRef.current.length > 0 || rafIdsRef.current.length > 0)
    ) {
      return;
    }
    const stu = studentMap.get(pendingSlot.studentId);
    if (!stu) return;

    transitionLockRef.current = true;
    const cardEl = deckStageRef.current?.querySelector(
      `[data-slot-index="${pendingSlot.slotIndex}"]`
    ) as HTMLElement | null;
    const sourceRect = cardEl ? toBoxRect(cardEl.getBoundingClientRect()) : null;
    const remainingMs = computeRemainingSpotlightHoldMs(activity.pendingRevealedAt, Date.now());

    startSpotlightSequence({
      slotIndex: pendingSlot.slotIndex,
      studentId: pendingSlot.studentId,
      cardBackVariant: pendingSlot.cardBackVariant,
      holdDurationMs: remainingMs,
      sourceRect,
      skipLift: true,
    });
  }, [
    activity.pendingRevealedAt,
    activity.status,
    pendingSlot,
    spotlight,
    startSpotlightSequence,
    studentMap,
  ]);

  const handleShuffle = useCallback(async () => {
    if (transitionLockRef.current || spotlight !== null || pendingSlot) return;
    setPendingWarning(null);
    try {
      const nextSlots = reshuffleRemainingSlots(activity.deckSlots);
      if (!settings.reduceMotion && !settings.lowPerformanceMode) {
        setIsShuffling(true);
        setTimeout(() => setIsShuffling(false), 380);
      }
      playSoundEffect('shuffle', settings.soundEnabled);
      triggerHapticFeedback('shuffle', hapticsOn);
      await onUpdateActivity({
        ...activity,
        deckSlots: nextSlots,
        pendingRevealedAt: undefined,
      });
    } catch (err) {
      setPendingWarning(
        err instanceof SecureRandomUnavailableError
          ? err.message
          : 'Could not shuffle the deck securely.'
      );
    }
  }, [
    activity,
    hapticsOn,
    onUpdateActivity,
    pendingSlot,
    settings.lowPerformanceMode,
    settings.reduceMotion,
    settings.soundEnabled,
    spotlight,
  ]);

  const handleCardClick = useCallback(
    async (slotIndex: number) => {
      // Strict double-tap, duplicate selection, and simultaneous animation guard
      if (transitionLockRef.current || spotlight !== null || pendingSlot) return;

      const clickedSlot = activity.deckSlots.find((s) => s.slotIndex === slotIndex);
      if (!clickedSlot || clickedSlot.state !== 'hidden' || !clickedSlot.studentId) return;

      transitionLockRef.current = true;
      setPendingWarning(null);

      try {
        const cardEl = deckStageRef.current?.querySelector(
          `[data-slot-index="${slotIndex}"]`
        ) as HTMLElement | null;
        const sourceRect = cardEl ? toBoxRect(cardEl.getBoundingClientRect()) : null;

        const revealRes = revealDeckSlot(
          activity.deckSlots,
          slotIndex,
          activity.selectionMode,
          fairnessWeights
        );

        if (!revealRes.ok) {
          transitionLockRef.current = false;
          if (revealRes.reason === 'already_pending') {
            setPendingWarning(
              `Card #${revealRes.pendingSlotIndex + 1} is already revealing. Cancel or wait for confirmation.`
            );
          }
          return;
        }

        playSoundEffect('flip', settings.soundEnabled);
        triggerHapticFeedback('flip', hapticsOn);

        await onUpdateActivity({
          ...activity,
          deckSlots: revealRes.slots,
          pendingRevealedAt: revealRes.revealedAt,
        });

        startSpotlightSequence({
          slotIndex,
          studentId: revealRes.revealedStudentId,
          cardBackVariant: clickedSlot.cardBackVariant,
          holdDurationMs: SPOTLIGHT_HOLD_MS,
          sourceRect,
          skipLift: false,
        });
      } catch (err) {
        transitionLockRef.current = false;
        setSpotlight(null);
        setPendingWarning(
          err instanceof SecureRandomUnavailableError
            ? err.message
            : 'Secure randomness is unavailable to draw a card.'
        );
      }
    },
    [
      activity,
      fairnessWeights,
      hapticsOn,
      onUpdateActivity,
      pendingSlot,
      settings.soundEnabled,
      spotlight,
      startSpotlightSequence,
    ]
  );

  const handleCancelReveal = useCallback(async () => {
    if (cancelInFlightRef.current) return;
    if (spotlight?.phase === 'flying_to_panel') return;

    cancelInFlightRef.current = true;
    setIsCancelling(true);
    clearRevealTimers();
    setSpotlight(null);
    setPendingWarning(null);

    try {
      const currentAct = activityRef.current;
      const nextSlots = cancelPendingReveal(currentAct.deckSlots);
      await onUpdateActivity({
        ...currentAct,
        deckSlots: nextSlots,
        pendingRevealedAt: undefined,
      });
    } finally {
      cancelInFlightRef.current = false;
      setIsCancelling(false);
      transitionLockRef.current = false;
    }
  }, [clearRevealTimers, onUpdateActivity, spotlight?.phase]);

  const handleConfirmRevealNow = useCallback(async () => {
    if (cancelInFlightRef.current || isConfirmingRef.current) return;
    clearRevealTimers();
    const currentAct = activityRef.current;
    const revealedAt = currentAct.pendingRevealedAt ?? 0;
    const elapsed = Date.now() - revealedAt;
    if (elapsed < 360) {
      await new Promise((r) => window.setTimeout(r, 360 - elapsed));
    }
    await finalizeAutoConfirm();
  }, [clearRevealTimers, finalizeAutoConfirm]);

  const handleUndo = useCallback(async () => {
    if (transitionLockRef.current || spotlight !== null || pendingSlot) return;
    setPendingWarning(null);
    try {
      const res = undoLastSelection(activity, (id) =>
        eligibleStudents.some((s) => s.id === id)
      );
      if (!res.undoneStudentId) return;
      playSoundEffect('undo', settings.soundEnabled);
      triggerHapticFeedback('undo', hapticsOn);
      await onUpdateActivity(res.activity);
      await onMarkLastSelectionUndone(activity.id, res.undoneStudentId);
    } catch (err) {
      setPendingWarning(
        err instanceof SecureRandomUnavailableError
          ? err.message
          : 'Could not undo selection securely.'
      );
    }
  }, [
    activity,
    eligibleStudents,
    hapticsOn,
    onMarkLastSelectionUndone,
    onUpdateActivity,
    pendingSlot,
    settings.soundEnabled,
    spotlight,
  ]);

  // Desktop keyboard shortcuts (Space: shuffle, Esc: cancel/exit, Z: undo, F: fullscreen)
  useEffect(() => {
    if (settings.keyboardShortcutsEnabled === false) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (confirmAction) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (spotlight || pendingSlot) {
          e.preventDefault();
          void handleCancelReveal();
        } else if (projectorMode) {
          e.preventDefault();
          setProjectorMode(false);
        }
        return;
      }

      if (spotlight || pendingSlot || transitionLockRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (
        e.key === ' ' &&
        tag !== 'BUTTON' &&
        tag !== 'A' &&
        activity.status === 'in_progress' &&
        hiddenCount > 0
      ) {
        e.preventDefault();
        void handleShuffle();
      } else if ((e.key === 'z' || e.key === 'Z') && selectedStudents.length > 0) {
        e.preventDefault();
        void handleUndo();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setProjectorMode((p) => !p);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activity.status,
    confirmAction,
    handleCancelReveal,
    handleShuffle,
    handleUndo,
    hiddenCount,
    pendingSlot,
    projectorMode,
    selectedStudents.length,
    settings.keyboardShortcutsEnabled,
    spotlight,
  ]);

  const handleConfirmResetShuffle = async () => {
    setConfirmAction(null);
    setPendingWarning(null);
    const nextSlots = reshuffleRemainingSlots(activity.deckSlots);
    playSoundEffect('shuffle', settings.soundEnabled);
    triggerHapticFeedback('shuffle', hapticsOn);
    await onUpdateActivity({
      ...activity,
      deckSlots: nextSlots,
      pendingRevealedAt: undefined,
    });
  };

  const handleConfirmResetRound = async () => {
    setConfirmAction(null);
    setPendingWarning(null);
    setCompletionBannerDismissed(false);
    const freshSlots = createDeckSlots(
      eligibleStudents,
      activity.selectionMode,
      fairnessWeights
    );
    await onResetActivitySelectionsInDb(activity.id);
    await onUpdateActivity({
      ...activity,
      deckSlots: freshSlots,
      selectedStudentIds: [],
      pendingRevealedAt: undefined,
      questionAssignments: [],
      rewardAssignments: [],
      status: 'in_progress',
      completedAt: undefined,
    });
  };

  const handleRevealQuestion = async () => {
    if (!activity.questionAssignments?.length) return;
    const updated = activity.questionAssignments.map((qa, idx) =>
      idx === activity.questionAssignments!.length - 1 ? { ...qa, revealed: true } : qa
    );
    await onUpdateActivity({ ...activity, questionAssignments: updated });
  };

  const handleRevealReward = async () => {
    if (!activity.rewardAssignments?.length) return;
    const updated = activity.rewardAssignments.map((ra, idx) =>
      idx === activity.rewardAssignments!.length - 1 ? { ...ra, revealed: true } : ra
    );
    await onUpdateActivity({ ...activity, rewardAssignments: updated });
  };

  const handleExportRoundCsv = () => {
    const csv = buildCsvDocument(
      ['Order', 'Roll Number', 'Student Name', 'Class', 'Activity', 'Selection Mode'],
      selectedStudents.map((s, idx) => [
        idx + 1,
        s.rollNumber,
        s.name,
        classRecord.name,
        getActivityDisplayLabel(activity.type),
        activity.selectionMode,
      ])
    );
    downloadTextFile(
      `${classRecord.name.toLowerCase().replace(/\s+/g, '-')}-round.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
  };

  const activityTitle =
    activity.type === 'lucky_picker' && activity.dutyTitle
      ? `${getActivityDisplayLabel(activity.type)}: ${activity.dutyTitle}`
      : getActivityDisplayLabel(activity.type);

  const isCompleted = activity.status === 'completed';
  const completionHeading =
    activity.type === 'two_toss'
      ? 'Two-Student Toss Pair Ready'
      : activity.type === 'lucky_picker'
        ? `${activity.dutyTitle ?? 'Duty'} Assigned`
        : 'All Eligible Cards Selected';

  const showDeckGridInStage =
    !isCompleted || (completedStageView === 'deck' && visibleSlots.length > 0);

  return (
    <div
      className={
        projectorMode
          ? 'fixed inset-0 z-40 bg-[var(--canvas)] safe-area-deck flex flex-col h-dvh overflow-hidden gap-2'
          : 'flex-1 min-h-0 flex flex-col gap-2 overflow-hidden relative'
      }
    >
      {/* Compact Single-Screen Deck Toolbar */}
      <div
        className={`shrink-0 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] ${
          isLandscapeMobile ? 'px-2.5 py-1.5' : 'px-3 py-2'
        }`}
      >
        <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
          <h1
            className={`font-display font-bold text-[var(--ink)] truncate ${
              isLandscapeMobile ? 'text-sm' : 'text-base sm:text-lg'
            }`}
          >
            {activityTitle}
          </h1>
          <span className="text-[11px] text-[var(--ink-muted)] font-mono-tabular whitespace-nowrap">
            {classRecord.name} · {hiddenCount} left · {selectedStudents.length}/{eligibleStudents.length} picked
            {activity.type === 'two_toss' && !isCompleted
              ? ` · Pick ${selectedStudents.length + 1}/2`
              : ''}
          </span>
          {isCompleted && completionBannerDismissed && (
            <button
              type="button"
              onClick={() => setCompletionBannerDismissed(false)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--sage-soft)] text-[var(--sage)] text-[11px] font-semibold cursor-pointer hover:opacity-90"
            >
              <CheckCircle2 className="w-3 h-3" />
              Round Complete · Show Actions
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {isCompleted ? (
            <button
              type="button"
              onClick={onStartNewRound}
              className={`inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] font-semibold text-white cursor-pointer whitespace-nowrap ${
                isLandscapeMobile ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{activity.type === 'two_toss' ? 'Start New Pair' : 'New Round'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={hiddenCount === 0}
              onClick={handleShuffle}
              className={`inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] font-semibold text-white cursor-pointer disabled:opacity-40 whitespace-nowrap ${
                isLandscapeMobile ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Shuffle</span>
            </button>
          )}

          <button
            type="button"
            disabled={selectedStudents.length === 0}
            onClick={handleUndo}
            className={`inline-flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer disabled:opacity-40 whitespace-nowrap ${
              isLandscapeMobile ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-xs sm:text-sm'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>

          {selectedStudents.length > 0 && (
            <button
              type="button"
              onClick={handleExportRoundCsv}
              className={`inline-flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer whitespace-nowrap ${
                isLandscapeMobile ? 'px-2 py-1' : 'px-2.5 py-1.5'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={onChooseAnotherActivity}
            className={`inline-flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer whitespace-nowrap ${
              isLandscapeMobile ? 'px-2 py-1' : 'px-2.5 py-1.5'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="hidden sm:inline">Switch Activity</span>
            <span className="sm:hidden">Switch</span>
          </button>

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setConfirmAction('reset_shuffle')}
              className={`rounded-xl border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer whitespace-nowrap ${
                isLandscapeMobile ? 'px-2 py-1' : 'px-2.5 py-1.5'
              }`}
            >
              Reset Shuffle
            </button>
          )}

          <button
            type="button"
            onClick={() => setConfirmAction('reset_round')}
            className={`rounded-xl border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer whitespace-nowrap ${
              isLandscapeMobile ? 'px-2 py-1' : 'px-2.5 py-1.5'
            }`}
          >
            Reset Round
          </button>

          <button
            type="button"
            onClick={() => setProjectorMode((p) => !p)}
            aria-label={projectorMode ? 'Exit projector mode' : 'Enter projector mode'}
            className="p-1.5 rounded-xl border border-[var(--border-hairline)] text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer"
            title={projectorMode ? 'Exit Projector Mode (F)' : 'Projector Fullscreen Mode (F)'}
          >
            {projectorMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Non-Blocking, Dismissible Activity Completion Notification Banner */}
      {isCompleted && !completionBannerDismissed && (
        <div
          role="status"
          data-testid="completion-notification-banner"
          className="shrink-0 rounded-xl bg-[var(--sage-soft)] border border-[var(--sage)]/35 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
        >
          <div className="min-w-0 flex items-start sm:items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[var(--sage)] shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-display font-bold text-[var(--ink)] flex flex-wrap items-center gap-x-2">
                <span>{completionHeading}</span>
                <span className="text-xs font-sans font-normal text-[var(--ink-muted)]">
                  · {selectedStudents.length} of {eligibleStudents.length} selected ({activity.selectionMode.replace('_', ' ')})
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[var(--ink-muted)]">
                Scroll through the Selected Students list or review every card in order below.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onStartNewRound}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {activity.type === 'two_toss' ? 'Start New Pair' : 'Start Another Round'}
            </button>
            <button
              type="button"
              onClick={handleExportRoundCsv}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={onReturnToClassOverview}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border-hairline)] text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer whitespace-nowrap"
            >
              Class Overview
            </button>
            <button
              type="button"
              data-testid="dismiss-completion-banner-btn"
              onClick={() => setCompletionBannerDismissed(true)}
              aria-label="Dismiss completion notification"
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]/70 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      )}

      {pendingWarning && (
        <div
          role="alert"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--gold-soft)] border border-[var(--gold)]/45 text-xs text-[var(--ink)] flex items-center justify-between gap-2"
        >
          <span className="truncate font-medium">{pendingWarning}</span>
          <button
            type="button"
            onClick={() => setPendingWarning(null)}
            className="font-semibold underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {activity.type === 'student_question' && latestQuestionAssignment && (
        <div className="shrink-0 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--accent)]/35 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <HelpCircle className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <div className="min-w-0 text-xs">
              <span className="font-semibold text-[var(--accent)]">
                {studentMap.get(latestQuestionAssignment.studentId)?.name} (
                {latestQuestionAssignment.subject}):
              </span>{' '}
              <span className="text-[var(--ink)]">
                {latestQuestionAssignment.revealed
                  ? latestQuestionAssignment.questionText
                  : 'Question ready when class is ready.'}
              </span>
            </div>
          </div>
          {!latestQuestionAssignment.revealed && (
            <button
              type="button"
              onClick={handleRevealQuestion}
              className="px-2.5 py-1 rounded-lg bg-[var(--accent)] text-xs font-semibold text-white cursor-pointer shrink-0"
            >
              Reveal Question
            </button>
          )}
        </div>
      )}

      {activity.type === 'mystery_reward' && latestRewardAssignment && (
        <div className="shrink-0 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--accent)]/35 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <div className="min-w-0 text-xs">
              <span className="font-semibold text-[var(--accent)]">
                {studentMap.get(latestRewardAssignment.studentId)?.name}:
              </span>{' '}
              <span className="text-[var(--ink)]">
                {latestRewardAssignment.revealed ? latestRewardAssignment.rewardText : 'Prompt ready.'}
              </span>
            </div>
          </div>
          {!latestRewardAssignment.revealed && (
            <button
              type="button"
              onClick={handleRevealReward}
              className="px-2.5 py-1 rounded-lg bg-[var(--accent)] text-xs font-semibold text-white cursor-pointer shrink-0"
            >
              Reveal Prompt
            </button>
          )}
        </div>
      )}

      {/* Automatic Pagination Tabs when card target would shrink below 28px */}
      {showDeckGridInStage && paginationPlan.needsPagination && (
        <div
          className="shrink-0 flex items-center justify-between gap-2 px-2 py-1 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] text-xs"
          aria-label="Deck page tabs"
        >
          <span className="text-[var(--ink-muted)] font-mono-tabular whitespace-nowrap">
            Deck Page {clampedPage + 1} / {paginationPlan.totalPages} ({activeDeckSlots.length} left)
          </span>
          <div className="flex items-center gap-1 overflow-x-auto">
            {Array.from({ length: paginationPlan.totalPages }, (_, pageIdx) => {
              const startNum = pageIdx * paginationPlan.pageSize + 1;
              const endNum = Math.min(
                activeDeckSlots.length,
                (pageIdx + 1) * paginationPlan.pageSize
              );
              const active = pageIdx === clampedPage;
              return (
                <button
                  key={pageIdx}
                  type="button"
                  onClick={() => setCurrentPage(pageIdx)}
                  className={`px-2.5 py-1 rounded-full font-mono-tabular text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--surface-subtle)] text-[var(--ink)] hover:bg-[var(--accent-soft)]'
                  }`}
                >
                  {startNum}–{endNum}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Single-Screen Fit Stage + Independently Scrollable Selected Students Panel */}
      <div
        className={`flex-1 min-h-0 flex gap-3 overflow-hidden ${
          isSidePanelLayout ? 'flex-row' : 'flex-col'
        }`}
      >
        {/* Bounded Size Container for Mystery Card Deck or Scrollable Completed Review */}
        <div
          ref={deckStageRef}
          data-testid="mystery-deck-stage"
          className="deck-stage-container flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col"
        >
          {showDeckGridInStage ? (
            <div className="flex-1 min-h-0 relative">
              {isCompleted && visibleSlots.length > 0 && (
                <div className="absolute top-2 right-2 z-10">
                  <button
                    type="button"
                    onClick={() => setCompletedStageView('selected_review')}
                    className="px-3 py-1.5 rounded-lg bg-[var(--surface)]/95 border border-[var(--border-hairline)] text-xs font-semibold text-[var(--accent)] shadow-xs cursor-pointer"
                  >
                    View Selected Cards ({selectedStudents.length})
                  </button>
                </div>
              )}
              <div
                data-testid="mystery-deck-grid"
                data-grid-cols={displayGrid.cols}
                data-grid-rows={displayGrid.rows}
                data-card-width={displayGrid.cardW}
                data-card-height={displayGrid.cardH}
                data-active-cards={visibleSlots.length}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${displayGrid.cols}, ${displayGrid.cardW}px)`,
                  gridTemplateRows: `repeat(${displayGrid.rows}, ${displayGrid.cardH}px)`,
                  gap: `${displayGrid.gap}px`,
                  justifyContent: 'center',
                  alignContent: 'center',
                  width: '100%',
                  height: '100%',
                }}
              >
                {visibleSlots.map((slot, idx) => {
                  const isLifted =
                    spotlight !== null && spotlight.slotIndex === slot.slotIndex;
                  const shiftX = computeLastRowShiftPx(visibleSlots.length, displayGrid, idx);
                  return (
                    <div
                      key={slot.slotIndex}
                      ref={(el) => {
                        if (el) {
                          cardCellRefs.current.set(slot.slotIndex, el);
                        } else {
                          cardCellRefs.current.delete(slot.slotIndex);
                        }
                      }}
                      style={shiftX > 0 ? { position: 'relative', left: `${shiftX}px` } : undefined}
                      className="w-full h-full min-w-0 min-h-0"
                    >
                      <MysteryFlipCard
                        slotIndex={slot.slotIndex}
                        state={slot.state}
                        student={null}
                        classNameLabel={classRecord.name}
                        cardBackTheme={settings.cardBackTheme}
                        cardBackVariant={slot.cardBackVariant}
                        isShuffling={isShuffling}
                        isLiftedInSpotlight={isLifted}
                        density={displayGrid.density}
                        largeCard={displayGrid.cardH >= 260}
                        fillCell
                        onCardClick={handleCardClick}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Scrollable Selected Cards Review Stage when Activity is Completed */
            <div
              data-testid="completed-selected-cards-stage"
              className="flex-1 min-h-0 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] flex flex-col overflow-hidden"
            >
              <div className="shrink-0 px-4 py-3 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-display font-bold text-[var(--ink)]">
                    Selected Cards Review ({selectedStudents.length} of {eligibleStudents.length})
                  </h2>
                  <p className="text-xs text-[var(--ink-muted)]">
                    Full selection order and student details for this round. Scroll to review all picks.
                  </p>
                </div>
                {visibleSlots.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCompletedStageView('deck')}
                    className="px-3 py-1.5 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--accent-soft)] text-xs font-semibold text-[var(--ink)] cursor-pointer whitespace-nowrap"
                  >
                    Show Remaining Deck ({visibleSlots.length})
                  </button>
                )}
              </div>

              <div
                data-testid="completed-selected-cards-grid"
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y p-3 sm:p-4"
              >
                <div
                  className={
                    activity.type === 'two_toss' && selectedStudents.length === 2
                      ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
                      : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3'
                  }
                >
                  {selectedStudents.map((stu, idx) => {
                    const assignedQ = questionByStudentId.get(stu.id);
                    const assignedR = rewardByStudentId.get(stu.id);
                    const assignedDuty =
                      activity.type === 'lucky_picker' ? activity.dutyTitle : undefined;

                    return (
                      <div
                        key={`${stu.id}-${idx}`}
                        data-testid={`completed-card-item-${idx + 1}`}
                        className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex flex-col gap-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono-tabular font-bold text-[var(--accent)]">
                            Pick #{idx + 1}
                          </span>
                          <span className="text-xs font-mono-tabular text-[var(--ink-muted)]">
                            Roll {stu.rollNumber}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <StudentAvatar
                            student={stu}
                            sizeVariant={activity.type === 'two_toss' ? 'full' : 'thumb'}
                            className="w-14 h-14 rounded-xl shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm sm:text-base font-display font-bold text-[var(--ink)] truncate">
                              {stu.name}
                            </div>
                            <div className="text-xs text-[var(--ink-muted)]">
                              {classRecord.name} · Roll {stu.rollNumber}
                            </div>
                            {stu.notes && (
                              <div className="text-[11px] text-[var(--ink-muted)] truncate mt-0.5">
                                {stu.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        {assignedDuty && (
                          <div className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--gold-soft)] text-[var(--ink)] font-medium">
                            Duty: {assignedDuty}
                          </div>
                        )}
                        {assignedQ && (
                          <div className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--ink)]">
                            <span className="font-semibold text-[var(--accent)]">
                              {assignedQ.subject}:
                            </span>{' '}
                            {assignedQ.questionText}
                          </div>
                        )}
                        {assignedR && (
                          <div className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--ink)]">
                            <span className="font-semibold text-[var(--accent)]">Prompt:</span>{' '}
                            {assignedR.rewardText}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selected Students Side Panel (188px on mobile landscape, 272-296px on tablet/desktop) */}
        {isSidePanelLayout ? (
          <aside
            ref={selectedTargetRef}
            data-testid="selected-students-panel"
            className={`${
              isLandscapeMobile ? 'w-[196px] p-2' : 'w-[280px] lg:w-[304px] p-3'
            } shrink-0 h-full rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] flex flex-col min-h-0 overflow-hidden`}
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-hairline)] shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <Users className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                <h2 className="text-xs sm:text-sm font-display font-bold text-[var(--ink)] truncate">
                  Selected Students
                </h2>
              </div>
              <span className="text-[11px] font-mono-tabular font-semibold text-[var(--ink-muted)] shrink-0">
                {selectedStudents.length}/{eligibleStudents.length}
              </span>
            </div>

            {selectedStudents.length === 0 ? (
              <p className="my-auto text-center text-[11px] text-[var(--ink-muted)] px-1">
                Confirmed picks appear here in selection order.
              </p>
            ) : (
              <div
                ref={selectedListScrollRef}
                data-testid="selected-students-scroll-list"
                tabIndex={0}
                aria-label="Selected students in selection order"
                className="mt-2 space-y-1.5 flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y pr-1"
              >
                {selectedStudents.map((stu, idx) => {
                  const assignedQ = questionByStudentId.get(stu.id);
                  const assignedR = rewardByStudentId.get(stu.id);
                  const assignedDuty =
                    activity.type === 'lucky_picker' ? activity.dutyTitle : undefined;

                  return (
                    <div
                      key={`${stu.id}-${idx}`}
                      data-testid={`selected-panel-item-${idx + 1}`}
                      className={`rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] ${
                        isLandscapeMobile ? 'px-1.5 py-1' : 'p-2'
                      }`}
                    >
                      <div className={`flex items-center ${isLandscapeMobile ? 'gap-1.5' : 'gap-2'}`}>
                        <span
                          className={`text-center text-[11px] font-mono-tabular font-bold text-[var(--accent)] shrink-0 ${
                            isLandscapeMobile ? 'w-4' : 'w-6'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <StudentAvatar
                          student={stu}
                          className={`${
                            isLandscapeMobile ? 'w-6 h-6 rounded-md' : 'w-8 h-8 rounded-lg'
                          } shrink-0`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-[var(--ink)] truncate">
                            {stu.name}
                          </div>
                          <div className="text-[10px] font-mono-tabular text-[var(--ink-muted)]">
                            Roll {stu.rollNumber}
                          </div>
                        </div>
                      </div>
                      {!isLandscapeMobile && (assignedDuty || assignedQ || assignedR) && (
                        <div className="mt-1 pt-1 border-t border-[var(--border-hairline)]/60 text-[10px] text-[var(--ink-muted)] truncate">
                          {assignedDuty
                            ? `Duty: ${assignedDuty}`
                            : assignedQ
                              ? `${assignedQ.subject}: ${assignedQ.questionText}`
                              : assignedR?.rewardText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        ) : (
          /* Portrait Mobile Compact Bottom Bar + Scrollable Drawer */
          <div
            ref={(el) => {
              selectedTargetRef.current = el;
            }}
            data-testid="selected-students-drawer-bar"
            className="shrink-0 relative"
          >
            {mobileDrawerOpen && (
              <div
                data-testid="selected-students-mobile-drawer-list"
                className="absolute bottom-full left-0 right-0 mb-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--border-hairline)] shadow-xl p-3 max-h-[55vh] overflow-y-auto overscroll-contain touch-pan-y z-30 space-y-2"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-hairline)]">
                  <span className="text-xs font-display font-bold text-[var(--ink)]">
                    Selected Students ({selectedStudents.length}/{eligibleStudents.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="text-xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                {selectedStudents.length === 0 ? (
                  <p className="text-xs text-[var(--ink-muted)] py-2 text-center">
                    No confirmed students yet.
                  </p>
                ) : (
                  selectedStudents.map((stu, idx) => {
                    const assignedQ = questionByStudentId.get(stu.id);
                    const assignedR = rewardByStudentId.get(stu.id);
                    const assignedDuty =
                      activity.type === 'lucky_picker' ? activity.dutyTitle : undefined;

                    return (
                      <div
                        key={`${stu.id}-${idx}`}
                        className="p-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-hairline)] flex items-center gap-2.5 text-xs"
                      >
                        <span className="font-mono-tabular font-bold text-[var(--accent)] w-6 shrink-0">
                          #{idx + 1}
                        </span>
                        <StudentAvatar student={stu} className="w-7 h-7 rounded-lg shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--ink)] truncate">{stu.name}</div>
                          <div className="text-[11px] font-mono-tabular text-[var(--ink-muted)]">
                            Roll {stu.rollNumber}
                            {assignedDuty
                              ? ` · ${assignedDuty}`
                              : assignedQ
                                ? ` · ${assignedQ.subject}`
                                : assignedR
                                  ? ' · Prompt assigned'
                                  : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen((o) => !o)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-hairline)] flex items-center justify-between text-xs font-semibold text-[var(--ink)] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-[var(--accent)]" />
                Selected Students ({selectedStudents.length} / {eligibleStudents.length})
              </span>
              {mobileDrawerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Full-Screen Cinematic Mystery Reveal Overlay */}
      {spotlight && studentMap.get(spotlight.studentId) && (
        <CinematicRevealOverlay
          student={studentMap.get(spotlight.studentId)!}
          classNameLabel={classRecord.name}
          slotIndex={spotlight.slotIndex}
          cardBackTheme={settings.cardBackTheme}
          cardBackVariant={spotlight.cardBackVariant}
          phase={spotlight.phase}
          holdDurationMs={spotlight.holdDurationMs}
          sourceRect={spotlight.sourceRect}
          targetRect={spotlight.targetRect}
          viewport={viewport}
          reduceMotion={effectiveReduceMotion}
          isMobileDrawerTarget={!isSidePanelLayout}
          isCancelling={isCancelling}
          onCancel={handleCancelReveal}
          onConfirmNow={handleConfirmRevealNow}
        />
      )}

      {/* Confirmations */}
      <ConfirmDialog
        open={confirmAction === 'reset_shuffle'}
        title="Reset Shuffle?"
        description="This re-randomizes the remaining face-down cards and clears any unconfirmed pending reveal. Already selected students and attendance stay untouched."
        confirmLabel="Reset Shuffle"
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmResetShuffle}
      />

      <ConfirmDialog
        open={confirmAction === 'reset_round'}
        title="Reset Current Round?"
        description="This clears the current activity’s selected list and restores all eligible students back into the mystery deck. Attendance, student records, and past completed sessions will not be deleted."
        confirmLabel="Reset Round"
        destructive
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleConfirmResetRound}
      />
    </div>
  );
};
