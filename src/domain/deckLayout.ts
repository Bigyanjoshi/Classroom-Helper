export type CardDensity = 'normal' | 'compact' | 'micro';

export const MIN_CARD_ASPECT = 0.68;
export const MAX_CARD_ASPECT = 0.92;
export const MIN_DECK_TOUCH_PX = 28;
export const WCAG_MIN_TOUCH_PX = 24;

export interface DeckGridPlan {
  cols: number;
  rows: number;
  gap: number;
  cellW: number;
  cellH: number;
  cardW: number;
  cardH: number;
  density: CardDensity;
  meetsTouchFloor: boolean;
}

export interface DeckPaginationPlan {
  needsPagination: boolean;
  pageSize: number;
  totalPages: number;
  grid: DeckGridPlan;
}

function chooseGap(cardCount: number, containerWidth: number, containerHeight: number): number {
  if (cardCount >= 40 || containerWidth < 460 || containerHeight < 320) {
    return 4;
  }
  if (cardCount >= 20 || containerWidth < 680 || containerHeight < 460) {
    return 6;
  }
  if (cardCount <= 6 && containerWidth >= 680 && containerHeight >= 460) {
    return 14;
  }
  return 10;
}

/**
 * Computes horizontal offset (in px) to center cards on an incomplete final row
 * inside a CSS Grid of `grid.cols` fixed `grid.cardW` tracks separated by `grid.gap`.
 */
export function computeLastRowShiftPx(
  cardCount: number,
  grid: Pick<DeckGridPlan, 'cols' | 'rows' | 'cardW' | 'gap'>,
  orderIndex: number
): number {
  if (cardCount <= 0 || grid.cols <= 1) return 0;
  const row = Math.floor(orderIndex / grid.cols);
  if (row !== grid.rows - 1) return 0;
  const remainder = cardCount % grid.cols;
  if (remainder === 0) return 0;
  const missingCols = grid.cols - remainder;
  return Math.round((missingCols * (grid.cardW + grid.gap)) / 2);
}

/**
 * Computes an optimal CSS Grid (cols x rows) so all mystery cards fit cleanly
 * inside a single bounded viewport container without scrolling across desktop,
 * mobile portrait, and rotated mobile landscape orientations.
 *
 * Uses Spec v2.0 flexible aspect bounds (0.68–0.92) and balanced size scoring:
 *   min(w, h) * 0.4 + sqrt(w * h) * 0.6
 */
export function computeOptimalDeckGrid(
  cardCount: number,
  containerWidth: number,
  containerHeight: number
): DeckGridPlan {
  if (cardCount <= 0) {
    const safeW = Math.max(containerWidth, 120);
    const safeH = Math.max(containerHeight, 140);
    return {
      cols: 1,
      rows: 1,
      gap: 8,
      cellW: safeW,
      cellH: safeH,
      cardW: Math.min(safeW, Math.round(safeH * MAX_CARD_ASPECT)),
      cardH: Math.min(safeH, Math.round(safeW / MIN_CARD_ASPECT)),
      density: 'normal',
      meetsTouchFloor: true,
    };
  }

  if (containerWidth <= 0 || containerHeight <= 0) {
    const cols = Math.min(4, cardCount);
    const rows = Math.ceil(cardCount / cols);
    return {
      cols,
      rows,
      gap: 8,
      cellW: 120,
      cellH: 150,
      cardW: 110,
      cardH: 145,
      density: cardCount > 12 ? 'compact' : 'normal',
      meetsTouchFloor: true,
    };
  }

  const gap = chooseGap(cardCount, containerWidth, containerHeight);

  let bestCols = 1;
  let bestRows = cardCount;
  let bestScore = -1;
  let bestCellW = 0;
  let bestCellH = 0;
  let bestCardW = 0;
  let bestCardH = 0;
  let bestMeetsTouch = false;

  for (let cols = 1; cols <= cardCount; cols++) {
    const rows = Math.ceil(cardCount / cols);
    const cellW = (containerWidth - gap * (cols - 1)) / cols;
    const cellH = (containerHeight - gap * (rows - 1)) / rows;
    if (cellW <= 0 || cellH <= 0) continue;

    // Fit card inside cell while clamping aspect ratio into [0.68, 0.92]
    const cardW = Math.min(cellW, cellH * MAX_CARD_ASPECT);
    const cardH = Math.min(cellH, cellW / MIN_CARD_ASPECT);
    if (cardW <= 0 || cardH <= 0) continue;

    const meetsTouch = cardW >= MIN_DECK_TOUCH_PX && cardH >= MIN_DECK_TOUCH_PX;

    // Balanced size score prioritizing true card area without extreme aspect skew
    const sizeScore = Math.min(cardW, cardH) * 0.2 + Math.sqrt(cardW * cardH) * 0.8;
    const totalSlots = cols * rows;
    const fillEfficiency = 0.96 + 0.04 * (cardCount / totalSlots);
    const touchBonus = meetsTouch ? 1.0 : 0.25;
    const score = sizeScore * fillEfficiency * touchBonus;

    if (score > bestScore) {
      bestScore = score;
      bestCols = cols;
      bestRows = rows;
      bestCellW = cellW;
      bestCellH = cellH;
      bestCardW = cardW;
      bestCardH = cardH;
      bestMeetsTouch = meetsTouch;
    }
  }

  const minCardDim = Math.min(bestCardW, bestCardH);
  const density: CardDensity =
    minCardDim < 78 || bestCardH < 96
      ? 'micro'
      : minCardDim < 122 || bestCardH < 150
        ? 'compact'
        : 'normal';

  return {
    cols: bestCols,
    rows: bestRows,
    gap,
    cellW: Math.floor(bestCellW),
    cellH: Math.floor(bestCellH),
    cardW: Math.floor(bestCardW),
    cardH: Math.floor(bestCardH),
    density,
    meetsTouchFloor: bestMeetsTouch,
  };
}

/**
 * Evaluates whether all `cardCount` cards fit on one viewport at >= 28px touch target size.
 * If not (e.g., 70 cards in an unusually tight mobile landscape frame), computes the largest
 * page size that satisfies the 28px touch floor and returns quick-tab pagination metadata.
 */
export function computeDeckPagination(
  cardCount: number,
  containerWidth: number,
  containerHeight: number
): DeckPaginationPlan {
  const fullGrid = computeOptimalDeckGrid(cardCount, containerWidth, containerHeight);
  if (cardCount <= 1 || fullGrid.meetsTouchFloor) {
    return {
      needsPagination: false,
      pageSize: Math.max(1, cardCount),
      totalPages: 1,
      grid: fullGrid,
    };
  }

  // Binary search largest page size that still achieves >= MIN_DECK_TOUCH_PX cards
  let lo = 1;
  let hi = cardCount - 1;
  let bestPageSize = 1;
  let bestGrid = computeOptimalDeckGrid(1, containerWidth, containerHeight);

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = computeOptimalDeckGrid(mid, containerWidth, containerHeight);
    if (candidate.meetsTouchFloor) {
      bestPageSize = mid;
      bestGrid = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Balance page counts evenly so the final tab is never a tiny 1-card orphan when avoidable
  const totalPages = Math.max(2, Math.ceil(cardCount / bestPageSize));
  const balancedPageSize = Math.ceil(cardCount / totalPages);
  const balancedGrid = computeOptimalDeckGrid(balancedPageSize, containerWidth, containerHeight);

  return {
    needsPagination: true,
    pageSize: balancedPageSize,
    totalPages,
    grid: balancedGrid.meetsTouchFloor ? balancedGrid : bestGrid,
  };
}
