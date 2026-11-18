import test from 'node:test';
import assert from 'node:assert/strict';
import { deltaE76, labToRgb, rgbToLab, validateSkinToneBuffers } from './photoProcessor';

test('rgbToLab and labToRgb roundtrip accurately across diverse tones', () => {
  const samples: Array<[number, number, number]> = [
    [246, 237, 228], // Light warm
    [215, 189, 150], // Medium warm
    [130, 92, 67],   // Rich brown
    [41, 36, 32],    // Deep espresso
  ];

  for (const [r, g, b] of samples) {
    const lab = rgbToLab(r, g, b);
    const [rr, gg, bb] = labToRgb(lab.L, lab.a, lab.b);
    assert.ok(Math.abs(r - rr) <= 2, `Red roundtrip ${r} -> ${rr}`);
    assert.ok(Math.abs(g - gg) <= 2, `Green roundtrip ${g} -> ${gg}`);
    assert.ok(Math.abs(b - bb) <= 2, `Blue roundtrip ${b} -> ${bb}`);
  }
});

test('validateSkinToneBuffers reports preserved, shifted, and inconclusive honestly', () => {
  const width = 64;
  const height = 64;
  const len = width * height * 4;

  // 1) Preserved deep skin chromaticity buffer
  const orig = new Uint8ClampedArray(len);
  const mild = new Uint8ClampedArray(len);
  for (let i = 0; i < len; i += 4) {
    orig[i] = 132;
    orig[i + 1] = 92;
    orig[i + 2] = 68;
    orig[i + 3] = 255;

    mild[i] = 130;
    mild[i + 1] = 91;
    mild[i + 2] = 67;
    mild[i + 3] = 255;
  }
  const okRes = validateSkinToneBuffers(orig, mild, width, height);
  assert.equal(okRes.checked, true);
  assert.equal(okRes.preserved, true);
  assert.ok((okRes.avgDeltaE ?? 99) < 3);

  // 2) Strongly shifted/bleached buffer -> preserved must be false
  const bleached = new Uint8ClampedArray(len);
  for (let i = 0; i < len; i += 4) {
    bleached[i] = 240;
    bleached[i + 1] = 220;
    bleached[i + 2] = 210;
    bleached[i + 3] = 255;
  }
  const badRes = validateSkinToneBuffers(orig, bleached, width, height);
  assert.equal(badRes.checked, true);
  assert.equal(badRes.preserved, false);
  assert.ok((badRes.avgDeltaE ?? 0) > 15);
  assert.ok(deltaE76(rgbToLab(132, 92, 68), rgbToLab(240, 220, 210)) > 15);

  // 3) Blue-only landscape/inconclusive framing -> checked=false, preserved=false (never lies!)
  const blueBuf = new Uint8ClampedArray(len);
  for (let i = 0; i < len; i += 4) {
    blueBuf[i] = 30;
    blueBuf[i + 1] = 100;
    blueBuf[i + 2] = 210;
    blueBuf[i + 3] = 255;
  }
  const inconclusiveRes = validateSkinToneBuffers(blueBuf, blueBuf, width, height);
  assert.equal(inconclusiveRes.checked, false);
  assert.equal(inconclusiveRes.preserved, false);
});
