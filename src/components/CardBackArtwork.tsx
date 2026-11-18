import React from 'react';
import type { CardDensity } from '../domain/deckLayout';
import type { CardBackTheme } from '../domain/types';

interface CardBackArtworkProps {
  theme: CardBackTheme;
  variant: number;
  cardNumberLabel?: number;
  density?: CardDensity;
  largeCard?: boolean;
}

/**
 * Decorative mystery card back.
 * Strictly zero student name, roll number, class, avatar, or presentation clues.
 * All variants share matching visual weight and complexity.
 */
export const CardBackArtwork: React.FC<CardBackArtworkProps> = ({
  theme,
  variant,
  cardNumberLabel,
  density = 'normal',
  largeCard = false,
}) => {
  const paletteMap: Record<CardBackTheme, { bg: string; pattern: string; border: string; emblem: string }> = {
    terracotta: {
      bg: '#D65A31',
      pattern: '#FDECE1',
      border: '#F7D2BA',
      emblem: '#FAF6EE',
    },
    botanical: {
      bg: '#2E6A56',
      pattern: '#E4F2EC',
      border: '#B8DEC9',
      emblem: '#FAF8F5',
    },
    geometric: {
      bg: '#4B5E73',
      pattern: '#E7EEF4',
      border: '#C4D4E2',
      emblem: '#FAF8F5',
    },
    constellation: {
      bg: '#5B496E',
      pattern: '#F1ECF6',
      border: '#D5C7E4',
      emblem: '#FAF8F5',
    },
  };

  const p = paletteMap[theme] ?? paletteMap.terracotta;
  const v = Math.abs(variant) % 6;

  const padCls =
    density === 'micro'
      ? 'p-1.5 rounded-xl'
      : density === 'compact'
        ? 'p-2 rounded-xl'
        : largeCard
          ? 'p-4 rounded-2xl'
          : 'p-2.5 rounded-2xl';
  const emblemBoxCls =
    density === 'micro'
      ? 'w-7 h-7 rounded-lg'
      : density === 'compact'
        ? 'w-9 h-9 rounded-lg'
        : largeCard
          ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-2xl'
          : 'w-12 h-12 rounded-xl';
  const starSize = density === 'micro' ? 14 : density === 'compact' ? 18 : largeCard ? 36 : 24;

  return (
    <div
      className={`w-full h-full ${padCls} flex flex-col justify-between select-none relative overflow-hidden`}
      style={{
        backgroundColor: p.bg,
        border: `2px solid ${p.border}`,
      }}
      aria-hidden="true"
    >
      {/* Subtle symmetrical background SVG pattern */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 160 220"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect x="8" y="8" width="144" height="204" rx="14" fill="none" stroke={p.pattern} strokeOpacity="0.35" strokeWidth="1.5" />
        {v === 0 && (
          <g stroke={p.pattern} strokeOpacity="0.2" strokeWidth="1.5" fill="none">
            <circle cx="80" cy="110" r="46" />
            <circle cx="80" cy="110" r="64" strokeDasharray="4 5" />
            <path d="M80 28 L80 56 M80 164 L80 192 M22 110 L48 110 M112 110 L138 110" />
          </g>
        )}
        {v === 1 && (
          <g stroke={p.pattern} strokeOpacity="0.2" strokeWidth="1.5" fill="none">
            <polygon points="80,46 130,110 80,174 30,110" />
            <polygon points="80,62 116,110 80,158 44,110" />
          </g>
        )}
        {v === 2 && (
          <g stroke={p.pattern} strokeOpacity="0.2" strokeWidth="1.5" fill="none">
            <rect x="36" y="66" width="88" height="88" rx="16" transform="rotate(45 80 110)" />
            <circle cx="80" cy="110" r="36" />
          </g>
        )}
        {v === 3 && (
          <g stroke={p.pattern} strokeOpacity="0.2" strokeWidth="1.5" fill="none">
            <path d="M24 62 Q80 42 136 62 M24 158 Q80 178 136 158" />
            <circle cx="80" cy="110" r="44" />
            <circle cx="80" cy="110" r="28" strokeDasharray="3 4" />
          </g>
        )}
        {v === 4 && (
          <g stroke={p.pattern} strokeOpacity="0.2" strokeWidth="1.5" fill="none">
            <polygon points="80,48 132,79 132,141 80,172 28,141 28,79" />
            <circle cx="80" cy="110" r="34" />
          </g>
        )}
        {v === 5 && (
          <g stroke={p.pattern} strokeOpacity="0.2" strokeWidth="1.5" fill="none">
            <circle cx="80" cy="74" r="24" />
            <circle cx="80" cy="146" r="24" />
            <circle cx="54" cy="110" r="24" />
            <circle cx="106" cy="110" r="24" />
          </g>
        )}
      </svg>

      <div
        className={`relative z-10 flex items-center justify-between font-mono-tabular opacity-85 leading-none ${
          density === 'micro' ? 'text-[9px]' : largeCard ? 'text-sm font-semibold' : 'text-[11px]'
        }`}
        style={{ color: p.emblem }}
      >
        <span>{cardNumberLabel ? `#${cardNumberLabel}` : '•'}</span>
        <span>•</span>
      </div>

      <div className="relative z-10 flex items-center justify-center my-auto">
        <div
          className={`${emblemBoxCls} flex items-center justify-center`}
          style={{ backgroundColor: 'rgba(255,255,255,0.16)', border: `1px solid ${p.border}` }}
        >
          <svg width={starSize} height={starSize} viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3L14.6 8.6L20.8 9.4L16.2 13.7L17.4 19.8L12 16.8L6.6 19.8L7.8 13.7L3.2 9.4L9.4 8.6L12 3Z"
              fill={p.emblem}
            />
          </svg>
        </div>
      </div>

      {density !== 'micro' && (
        <div
          className={`relative z-10 text-center font-medium tracking-wide opacity-90 leading-none ${
            density === 'compact' ? 'text-[9px]' : largeCard ? 'text-xs sm:text-sm' : 'text-[11px]'
          }`}
          style={{ color: p.emblem }}
        >
          Mystery
        </div>
      )}
    </div>
  );
};
