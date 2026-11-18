import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDeckPagination,
  computeLastRowShiftPx,
  computeOptimalDeckGrid,
  MAX_CARD_ASPECT,
  MIN_CARD_ASPECT,
  MIN_DECK_TOUCH_PX,
} from './deckLayout';

// Approximate usable Mystery Deck stage dimensions (after header & compact HUD) across all 7 required viewports
const VIEWPORT_STAGES = [
  { name: '360x780 portrait', w: 344, h: 615 },
  { name: '390x844 portrait', w: 374, h: 675 },
  { name: '780x360 landscape', w: 610, h: 295 },
  { name: '844x390 landscape', w: 670, h: 325 },
  { name: '768x1024 tablet', w: 460, h: 920 },
  { name: '1280x720 laptop', w: 740, h: 630 },
  { name: '1920x1080 desktop', w: 1360, h: 980 },
] as const;

const ROSTER_SIZES = [15, 25, 35, 45, 60, 70] as const;

test('computeDeckPagination satisfies zero-overflow, 0.68..0.92 aspect ratio, and >=28px touch floor across all 7 viewports x 6 roster sizes', () => {
  for (const vp of VIEWPORT_STAGES) {
    for (const count of ROSTER_SIZES) {
      const plan = computeDeckPagination(count, vp.w, vp.h);
      const { grid } = plan;

      const expectedCapacity = plan.needsPagination ? plan.pageSize : count;
      assert.ok(
        grid.cols * grid.rows >= expectedCapacity,
        `${vp.name} (${count}): grid slots cover visible page`
      );

      const usedW = grid.cols * grid.cardW + (grid.cols - 1) * grid.gap;
      const usedH = grid.rows * grid.cardH + (grid.rows - 1) * grid.gap;
      assert.ok(usedW <= vp.w + 1, `${vp.name} (${count}): usedW ${usedW} <= ${vp.w}`);
      assert.ok(usedH <= vp.h + 1, `${vp.name} (${count}): usedH ${usedH} <= ${vp.h}`);

      assert.ok(
        grid.cardW >= MIN_DECK_TOUCH_PX && grid.cardH >= MIN_DECK_TOUCH_PX,
        `${vp.name} (${count}): card ${grid.cardW}x${grid.cardH} >= ${MIN_DECK_TOUCH_PX}px touch floor`
      );

      const aspect = grid.cardW / grid.cardH;
      assert.ok(
        aspect >= MIN_CARD_ASPECT - 0.04 && aspect <= MAX_CARD_ASPECT + 0.04,
        `${vp.name} (${count}): aspect ${aspect.toFixed(2)} within [0.68, 0.92]`
      );
    }
  }
});

test('computeDeckPagination triggers quick-tab pagination when 70 cards cannot fit >=28px on a single small stage', () => {
  const tight = computeDeckPagination(70, 320, 220);
  assert.equal(tight.needsPagination, true);
  assert.ok(tight.totalPages >= 2);
  assert.ok(tight.grid.cardW >= MIN_DECK_TOUCH_PX && tight.grid.cardH >= MIN_DECK_TOUCH_PX);

  const roomy = computeOptimalDeckGrid(24, 920, 650);
  assert.equal(roomy.meetsTouchFloor, true);
});

test('dynamic resizing grows remaining cards proportionally and centers partial final rows', () => {
  const stages = [
    { w: 1020, h: 740 },
    { w: 374, h: 675 },
    { w: 670, h: 325 },
  ];

  for (const stage of stages) {
    let prevArea = 0;
    for (const count of [24, 16, 12, 8, 7, 6, 5, 4, 3, 2, 1]) {
      const grid = computeOptimalDeckGrid(count, stage.w, stage.h);
      const area = grid.cardW * grid.cardH;
      assert.ok(
        area >= prevArea * 0.95,
        `${stage.w}x${stage.h} count=${count}: area ${area} keeps pace with prev=${prevArea}`
      );
      const aspect = grid.cardW / grid.cardH;
      assert.ok(aspect >= MIN_CARD_ASPECT - 0.04 && aspect <= MAX_CARD_ASPECT + 0.04);
      prevArea = area;
    }

    const g8 = computeOptimalDeckGrid(8, stage.w, stage.h);
    const g4 = computeOptimalDeckGrid(4, stage.w, stage.h);
    const g1 = computeOptimalDeckGrid(1, stage.w, stage.h);
    assert.ok(g4.cardW * g4.cardH > g8.cardW * g8.cardH);
    assert.ok(g1.cardW * g1.cardH >= g4.cardW * g4.cardH);
  }

  // 5 cards in a 3x2 grid centers the 2 cards on row 2 cleanly
  const grid5 = computeOptimalDeckGrid(5, 1020, 740);
  assert.equal(grid5.cols, 3);
  assert.equal(grid5.rows, 2);
  assert.equal(computeLastRowShiftPx(5, grid5, 0), 0);
  assert.equal(computeLastRowShiftPx(5, grid5, 2), 0);
  const expectedShift = Math.round((grid5.cardW + grid5.gap) / 2);
  assert.equal(computeLastRowShiftPx(5, grid5, 3), expectedShift);
  assert.equal(computeLastRowShiftPx(5, grid5, 4), expectedShift);
});
