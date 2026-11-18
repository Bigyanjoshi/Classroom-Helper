import React, { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { SPOTLIGHT_FLY_MS, SPOTLIGHT_LIFT_MS } from '../domain/deckStateMachine';
import type { CardBackTheme, Student } from '../domain/types';
import { CardBackArtwork } from './CardBackArtwork';
import { StudentAvatar } from './StudentAvatar';

export type CinematicRevealPhase =
  | 'idle'
  | 'lift_start'
  | 'lifting'
  | 'spotlight'
  | 'flying_to_panel';

export interface BoxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CinematicRevealOverlayProps {
  student: Student;
  classNameLabel: string;
  slotIndex: number;
  cardBackTheme: CardBackTheme;
  cardBackVariant: number;
  phase: Exclude<CinematicRevealPhase, 'idle'>;
  holdDurationMs: number;
  sourceRect: BoxRect | null;
  targetRect: BoxRect | null;
  viewport: { width: number; height: number };
  reduceMotion: boolean;
  isMobileDrawerTarget: boolean;
  isCancelling?: boolean;
  onCancel: () => void;
  onConfirmNow?: () => void;
}

function formatSpotlightCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '';
  if (remainingMs > 3000) return '3.5s';
  return `${Math.ceil(remainingMs / 1000)}s`;
}

export const CinematicRevealOverlay: React.FC<CinematicRevealOverlayProps> = ({
  student,
  classNameLabel,
  slotIndex,
  cardBackTheme,
  cardBackVariant,
  phase,
  holdDurationMs,
  sourceRect,
  targetRect,
  viewport,
  reduceMotion,
  isMobileDrawerTarget,
  isCancelling = false,
  onCancel,
  onConfirmNow,
}) => {
  const [countdownLabel, setCountdownLabel] = useState(() =>
    formatSpotlightCountdown(holdDurationMs)
  );

  useEffect(() => {
    if (phase !== 'spotlight') return;
    const startedAt = Date.now();
    setCountdownLabel(formatSpotlightCountdown(holdDurationMs));
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, holdDurationMs - (Date.now() - startedAt));
      setCountdownLabel(formatSpotlightCountdown(remaining));
    }, 200);
    return () => window.clearInterval(interval);
  }, [phase, holdDurationMs]);

  const isLandscapeShort = viewport.height <= 480;
  const footerReserve = isLandscapeShort ? 92 : 116;
  const availableH = Math.max(170, viewport.height - footerReserve - 24);
  const maxCardH = isLandscapeShort ? 264 : viewport.width >= 768 ? 440 : 380;
  const cardH = Math.min(maxCardH, availableH);
  const cardW = Math.min(viewport.width - 32, Math.round(cardH * 0.76));

  const centerX = viewport.width / 2;
  const centerY = (viewport.height - footerReserve) / 2;
  const cardLeft = Math.round(centerX - cardW / 2);
  const cardTop = Math.round(centerY - cardH / 2);

  let cardTransform = 'translate3d(0px, 0px, 0px) scale(1, 1)';
  let cardOpacity = 1;
  let cardTransition = 'none';

  if (phase === 'lift_start' && sourceRect && !reduceMotion) {
    const dx = sourceRect.left + sourceRect.width / 2 - centerX;
    const dy = sourceRect.top + sourceRect.height / 2 - centerY;
    const sx = Math.max(0.15, sourceRect.width / cardW);
    const sy = Math.max(0.15, sourceRect.height / cardH);
    cardTransform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    cardTransition = 'none';
  } else if (phase === 'lifting') {
    cardTransform = 'translate3d(0px, 0px, 0px) scale(1, 1)';
    cardTransition = reduceMotion
      ? 'none'
      : `transform ${SPOTLIGHT_LIFT_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out`;
  } else if (phase === 'spotlight') {
    cardTransform = 'translate3d(0px, 0px, 0px) scale(1, 1)';
    cardTransition = reduceMotion ? 'none' : 'transform 220ms ease-out';
  } else if (phase === 'flying_to_panel') {
    if (targetRect && !reduceMotion) {
      const tx = targetRect.left + targetRect.width / 2 - centerX;
      const ty =
        targetRect.top +
        (isMobileDrawerTarget
          ? targetRect.height / 2
          : Math.min(targetRect.height / 2, 72)) -
        centerY;
      const targetWidthBasis = isMobileDrawerTarget
        ? Math.min(96, targetRect.width * 0.28)
        : Math.max(48, targetRect.width * 0.44);
      const tScale = Math.max(0.15, Math.min(0.34, targetWidthBasis / cardW));
      cardTransform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${tScale.toFixed(3)})`;
      cardOpacity = 0.14;
      cardTransition = `transform ${SPOTLIGHT_FLY_MS}ms cubic-bezier(0.32, 0, 0.67, 0), opacity ${Math.max(
        240,
        SPOTLIGHT_FLY_MS - 40
      )}ms ease-in`;
    } else {
      cardOpacity = 0;
      cardTransition = 'opacity 140ms ease-out';
    }
  }

  const isFlipped = phase !== 'lift_start';
  const showBackdrop = phase === 'lifting' || phase === 'spotlight';
  const showControls = phase === 'lifting' || phase === 'spotlight';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Mystery Reveal: ${student.name}, Roll ${student.rollNumber}`}
      data-testid="cinematic-reveal-spotlight"
      data-reveal-phase={phase}
      className="fixed inset-0 z-50 overflow-hidden select-none"
    >
      {/* Dimmed Warm Espresso Backdrop */}
      <div
        className={`absolute inset-0 bg-[#231C16]/72 ${
          reduceMotion ? '' : 'transition-opacity duration-300 ease-out'
        } ${showBackdrop ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Subtle Warm Radial Spotlight Glow behind Card */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,246,238,0.28)_0%,rgba(230,162,60,0.12)_30%,transparent_65%)] ${
          reduceMotion ? '' : 'transition-opacity duration-300'
        } ${showBackdrop ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* GPU-Composited FLIP + 3D Card Stage */}
      <div
        data-testid="cinematic-reveal-card"
        style={{
          position: 'fixed',
          left: `${cardLeft}px`,
          top: `${cardTop}px`,
          width: `${cardW}px`,
          height: `${cardH}px`,
          transform: cardTransform,
          opacity: cardOpacity,
          transition: cardTransition,
          willChange: 'transform, opacity',
        }}
        className="card-perspective z-10 pointer-events-none"
      >
        <div className={`card-inner spotlight-card-inner ${isFlipped ? 'is-flipped' : ''}`}>
          {/* Card Back Face */}
          <div className="card-face">
            <CardBackArtwork
              theme={cardBackTheme}
              variant={cardBackVariant}
              cardNumberLabel={slotIndex + 1}
              density="normal"
            />
          </div>

          {/* Card Front Face (Existing Student Avatar, Name, Roll, Class) */}
          <div className="card-face card-face-front">
            <div
              className={`w-full h-full rounded-3xl bg-[var(--surface)] border-2 border-[var(--gold)] shadow-[0_24px_60px_rgba(35,28,22,0.34)] flex flex-col items-center justify-between text-center overflow-hidden ${
                isLandscapeShort ? 'p-3' : 'p-4 sm:p-5'
              }`}
            >
              {/* Top Roll + Class Header */}
              <div className="w-full flex items-center justify-between gap-2 shrink-0">
                <span className="px-2.5 py-1 rounded-full bg-[var(--surface-subtle)] border border-[var(--border-hairline)] font-mono-tabular text-xs font-semibold text-[var(--ink)]">
                  Roll {student.rollNumber}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)] truncate max-w-[140px]">
                  {classNameLabel}
                </span>
              </div>

              {/* Hero 3D Avatar / Local Photo with Subtle Celebration Animation */}
              <div className="flex-1 min-h-0 w-full flex items-center justify-center py-2">
                <StudentAvatar
                  student={student}
                  sizeVariant="full"
                  celebrate={phase === 'spotlight' && !reduceMotion}
                  className={
                    isLandscapeShort
                      ? 'h-full max-h-[145px] aspect-square rounded-2xl border border-[var(--border-hairline)] shadow-xs'
                      : 'h-full max-h-[215px] sm:max-h-[240px] aspect-square rounded-2xl border border-[var(--border-hairline)] shadow-xs'
                  }
                />
              </div>

              {/* Revealed Student Name + Badge */}
              <div className="w-full shrink-0 space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--sage)]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Mystery Card #{slotIndex + 1}</span>
                </div>
                <h2
                  className={`font-display font-bold text-[var(--ink)] leading-tight truncate ${
                    isLandscapeShort ? 'text-xl' : 'text-2xl sm:text-3xl'
                  }`}
                >
                  {student.name}
                </h2>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Spotlight Footer: Progress & Cancel Control */}
      {showControls && (
        <div
          className={`fixed inset-x-0 bottom-0 z-20 flex flex-col items-center justify-center px-4 ${
            isLandscapeShort ? 'pb-2.5 gap-1.5' : 'pb-5 sm:pb-7 gap-2.5'
          } ${reduceMotion ? '' : 'transition-opacity duration-200'}`}
        >
          <div className="w-full max-w-xs space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-[var(--surface)]/30 overflow-hidden">
              {phase === 'spotlight' && !reduceMotion && (
                <div
                  key={`${student.id}-${holdDurationMs}`}
                  style={{ animationDuration: `${holdDurationMs}ms` }}
                  className="h-full w-full rounded-full bg-[var(--gold)] spotlight-countdown-bar"
                />
              )}
            </div>
            <div className="text-center text-xs font-medium text-[#FAF6EE]/90">
              {phase === 'spotlight'
                ? countdownLabel
                  ? `Adding to Selected in ${countdownLabel}…`
                  : 'Adding to Selected…'
                : 'Revealing mystery card…'}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onConfirmNow && (
              <button
                type="button"
                data-testid="confirm-spotlight-now-btn"
                disabled={isCancelling}
                onClick={onConfirmNow}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-xs sm:text-sm font-semibold text-white shadow-lg cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Confirm Pick</span>
              </button>
            )}
            <button
              type="button"
              disabled={isCancelling}
              onClick={onCancel}
              aria-label="Cancel reveal and return card face down"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-subtle)] border border-[var(--border-hairline)] text-xs sm:text-sm font-semibold text-[var(--ink)] shadow-lg cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4 text-[var(--crimson)]" />
              <span>Cancel Reveal (Esc)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
