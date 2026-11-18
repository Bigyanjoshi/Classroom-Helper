import React from 'react';
import { X } from 'lucide-react';
import type { CardDensity } from '../domain/deckLayout';
import type { CardBackTheme, Student } from '../domain/types';
import { CardBackArtwork } from './CardBackArtwork';
import { StudentAvatar } from './StudentAvatar';

interface StudentCardFrontProps {
  student: Student;
  classNameLabel: string;
  isPending?: boolean;
  celebrate?: boolean;
  compact?: boolean;
  density?: CardDensity;
}

export const StudentCardFront: React.FC<StudentCardFrontProps> = ({
  student,
  classNameLabel,
  isPending = false,
  celebrate = false,
  compact = false,
  density = 'normal',
}) => {
  const effectiveDensity: CardDensity = compact && density === 'normal' ? 'compact' : density;

  const paddingCls =
    effectiveDensity === 'micro'
      ? 'p-1.5 rounded-xl'
      : effectiveDensity === 'compact'
        ? 'p-2 rounded-xl'
        : 'p-3 rounded-2xl';

  return (
    <div
      className={`w-full h-full min-h-0 overflow-hidden bg-[var(--surface)] border flex flex-col items-center justify-between text-center select-none ${paddingCls} ${
        isPending
          ? 'border-[var(--gold)] ring-2 ring-[var(--gold)]/35 shadow-[var(--shadow-card)]'
          : 'border-[var(--border-hairline)] shadow-[var(--shadow-card)]'
      }`}
    >
      <div
        className={`w-full flex items-center justify-between gap-1 text-[var(--ink-muted)] shrink-0 leading-none ${
          effectiveDensity === 'micro'
            ? 'text-[9px] pr-5'
            : effectiveDensity === 'compact'
              ? 'text-[11px] pr-6'
              : 'text-[11px] pr-12'
        }`}
      >
        <span className="font-mono-tabular font-semibold text-[var(--ink)] truncate">
          {effectiveDensity === 'micro' ? `#${student.rollNumber}` : `Roll ${student.rollNumber}`}
        </span>
        {!isPending && effectiveDensity === 'normal' && (
          <span className="truncate max-w-[84px]">{classNameLabel}</span>
        )}
      </div>

      <div className="flex-1 min-h-0 w-full flex items-center justify-center py-1 overflow-hidden">
        <StudentAvatar
          student={student}
          celebrate={celebrate}
          sizeVariant={effectiveDensity === 'normal' ? 'full' : 'thumb'}
          className={
            effectiveDensity === 'micro'
              ? 'h-full max-h-14 aspect-square rounded-lg'
              : effectiveDensity === 'compact'
                ? 'h-full max-h-24 aspect-square rounded-xl'
                : 'h-full max-h-44 aspect-square rounded-2xl'
          }
        />
      </div>

      <div className="w-full shrink-0">
        <div
          className={`font-display font-semibold text-[var(--ink)] truncate leading-tight ${
            effectiveDensity === 'micro'
              ? 'text-[11px]'
              : effectiveDensity === 'compact'
                ? 'text-xs'
                : 'text-sm sm:text-base'
          }`}
        >
          {student.name}
        </div>
        {isPending && (
          <div
            className={`font-semibold text-[var(--accent)] leading-tight ${
              effectiveDensity === 'micro' ? 'text-[9px] mt-0.5' : 'text-[11px] mt-0.5'
            }`}
          >
            {effectiveDensity === 'micro' ? 'Tap again' : 'Tap again to confirm'}
          </div>
        )}
      </div>
    </div>
  );
};

interface MysteryFlipCardProps {
  slotIndex: number;
  state: 'hidden' | 'pending_reveal' | 'empty';
  student: Student | null;
  classNameLabel: string;
  cardBackTheme: CardBackTheme;
  cardBackVariant: number;
  isShuffling?: boolean;
  isLiftedInSpotlight?: boolean;
  density?: CardDensity;
  largeCard?: boolean;
  fillCell?: boolean;
  onCardClick: (slotIndex: number) => void;
  onCancelReveal?: () => void;
}

/**
 * Interactive Mystery Card supporting the Two-Tap / Cinematic Reveal -> Confirm flow.
 * STRICT PRIVACY INVARIANT: Student identity is NEVER rendered into the DOM while `state === 'hidden'`.
 */
export const MysteryFlipCard: React.FC<MysteryFlipCardProps> = ({
  slotIndex,
  state,
  student,
  classNameLabel,
  cardBackTheme,
  cardBackVariant,
  isShuffling = false,
  isLiftedInSpotlight = false,
  density = 'normal',
  largeCard = false,
  fillCell = false,
  onCardClick,
  onCancelReveal,
}) => {
  const sizeCls = fillCell ? 'w-full h-full min-h-0' : 'aspect-[3/4]';

  if (state === 'empty') {
    return (
      <div
        className={`${sizeCls} ${
          density === 'micro' ? 'rounded-xl p-1' : 'rounded-2xl p-2'
        } border border-dashed border-[var(--border-hairline)] bg-[var(--surface-subtle)]/60 flex flex-col items-center justify-center text-center`}
        data-slot-index={slotIndex}
        data-slot-state="empty"
      >
        <span
          className={`${
            density === 'micro' ? 'text-[10px]' : 'text-xs'
          } font-mono-tabular text-[var(--ink-muted)]`}
        >
          #{slotIndex + 1}
        </span>
        {density !== 'micro' && (
          <span className="mt-0.5 text-[11px] text-[var(--ink-muted)]">Picked</span>
        )}
      </div>
    );
  }

  if (isLiftedInSpotlight) {
    return (
      <div
        aria-hidden="true"
        data-slot-index={slotIndex}
        data-slot-state="lifted"
        className={`${sizeCls} ${
          density === 'micro' ? 'rounded-xl p-1' : 'rounded-2xl p-2'
        } border-2 border-dashed border-[var(--gold)]/60 bg-[var(--gold-soft)]/35 flex flex-col items-center justify-center text-center`}
      >
        <span
          className={`${
            density === 'micro' ? 'text-[10px]' : 'text-xs'
          } font-mono-tabular text-[var(--accent)]/80`}
        >
          #{slotIndex + 1}
        </span>
      </div>
    );
  }

  const isRevealed = state === 'pending_reveal' && student !== null;

  return (
    <div className={`relative ${sizeCls} ${isShuffling ? 'animate-shuffle' : ''}`}>
      <button
        type="button"
        onClick={() => onCardClick(slotIndex)}
        aria-label={
          isRevealed && student
            ? `Confirm selection of ${student.name}, Roll ${student.rollNumber}`
            : `Reveal mystery card ${slotIndex + 1}`
        }
        data-slot-index={slotIndex}
        data-slot-state={state}
        className={`card-perspective block w-full h-full text-left ${
          density === 'micro' ? 'rounded-xl' : 'rounded-2xl'
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.98]`}
      >
        <div className={`card-inner ${isRevealed ? 'is-flipped' : ''}`}>
          <div className="card-face">
            <CardBackArtwork
              theme={cardBackTheme}
              variant={cardBackVariant}
              cardNumberLabel={slotIndex + 1}
              density={density}
              largeCard={largeCard}
            />
          </div>
          <div className="card-face card-face-front">
            {/* CRITICAL PRIVACY RULE: Only mount student front content when revealed */}
            {isRevealed && student ? (
              <StudentCardFront
                student={student}
                classNameLabel={classNameLabel}
                isPending
                celebrate
                density={density}
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-[var(--surface)]" />
            )}
          </div>
        </div>
      </button>

      {isRevealed && onCancelReveal && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancelReveal();
          }}
          className={`absolute top-1.5 right-1.5 z-20 rounded-md bg-[var(--surface)] border border-[var(--border-hairline)] shadow-2xs font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-subtle)] cursor-pointer flex items-center justify-center ${
            density === 'normal' ? 'px-2 py-0.5 text-[11px]' : 'w-6 h-6'
          }`}
          aria-label="Cancel reveal and turn card face down"
          title="Cancel reveal"
        >
          {density === 'normal' ? 'Cancel' : <X className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
};
