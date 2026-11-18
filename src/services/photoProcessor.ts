export interface PhotoProcessOptions {
  rotationDeg: 0 | 90 | 180 | 270;
  zoom: number;
  offsetX: number; // -1 to 1
  offsetY: number; // -1 to 1
  cartoonIntensity: number; // 1 (subtle) to 5 (illustrated)
  backdropColor: string | 'transparent';
}

export interface SkinToneValidationResult {
  checked: boolean;
  preserved: boolean;
  sampleCount: number;
  avgDeltaE: number | null;
  message: string;
}

export interface PhotoProcessResult {
  cartoonDataUrl: string;
  thumbnailDataUrl: string;
  fullDataUrl: string;
  originalCroppedDataUrl: string;
  validation: SkinToneValidationResult;
  width: number;
  height: number;
}

export interface LabColor {
  L: number;
  a: number;
  b: number;
}

function srgbChannelToLinear(c: number): number {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

function linearToSrgbChannel(c: number): number {
  const clamped = Math.max(0, Math.min(1, c));
  const s = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, s * 255)));
}

function labPivot(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function labInvPivot(t: number): number {
  const t3 = t * t * t;
  return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
}

/** Converts sRGB (0..255) to CIE L*a*b* (D65 illuminant). */
export function rgbToLab(r: number, g: number, b: number): LabColor {
  const lr = srgbChannelToLinear(r);
  const lg = srgbChannelToLinear(g);
  const lb = srgbChannelToLinear(b);

  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / 1.08883;

  const fx = labPivot(x);
  const fy = labPivot(y);
  const fz = labPivot(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** Converts CIE L*a*b* (D65) back to clamped sRGB (0..255). */
export function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const x = 0.95047 * labInvPivot(fx);
  const y = 1.0 * labInvPivot(fy);
  const z = 1.08883 * labInvPivot(fz);

  const lr = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const lg = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const lb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

  return [linearToSrgbChannel(lr), linearToSrgbChannel(lg), linearToSrgbChannel(lb)];
}

export function deltaE76(c1: LabColor, c2: LabColor): number {
  const dL = c1.L - c2.L;
  const da = c1.a - c2.a;
  const db = c1.b - c2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Pure heuristic check used strictly as a local fidelity safeguard after
 * cartoon stylization—never as identity, ethnicity, or demographic inference.
 * Detects central skin-chromaticity candidate pixels and measures Delta-E76 shift.
 */
export function validateSkinToneBuffers(
  beforeRgba: Uint8ClampedArray,
  afterRgba: Uint8ClampedArray,
  width: number,
  height: number
): SkinToneValidationResult {
  if (
    beforeRgba.length !== afterRgba.length ||
    beforeRgba.length < width * height * 4 ||
    width <= 0 ||
    height <= 0
  ) {
    return {
      checked: false,
      preserved: false,
      sampleCount: 0,
      avgDeltaE: null,
      message: 'Skin-tone validation could not run on this image buffer. Use Original or a Classroom Avatar if needed.',
    };
  }

  // Focus within the central portrait framing region (middle 50% width, upper-middle 55% height)
  const xMin = Math.floor(width * 0.25);
  const xMax = Math.ceil(width * 0.75);
  const yMin = Math.floor(height * 0.18);
  const yMax = Math.ceil(height * 0.72);

  let sampleCount = 0;
  let totalDeltaE = 0;

  for (let y = yMin; y < yMax; y += 2) {
    for (let x = xMin; x < xMax; x += 2) {
      const idx = (y * width + x) * 4;
      if (beforeRgba[idx + 3] < 200) continue;

      const labBefore = rgbToLab(beforeRgba[idx], beforeRgba[idx + 1], beforeRgba[idx + 2]);
      // Wide inclusive skin-chromaticity envelope in CIELAB (a* positive-warm, b* positive)
      if (labBefore.L > 12 && labBefore.L < 95 && labBefore.a > 2 && labBefore.a < 32 && labBefore.b > 4 && labBefore.b < 38) {
        const labAfter = rgbToLab(afterRgba[idx], afterRgba[idx + 1], afterRgba[idx + 2]);
        totalDeltaE += deltaE76(labBefore, labAfter);
        sampleCount++;
      }
    }
  }

  if (sampleCount < 45) {
    return {
      checked: false,
      preserved: false,
      sampleCount,
      avgDeltaE: null,
      message: 'Skin-tone region was inconclusive in this framing. Compare Original vs Illustrated or pick a Classroom Avatar.',
    };
  }

  const avgDeltaE = Number((totalDeltaE / sampleCount).toFixed(2));
  const preserved = avgDeltaE <= 8.5;

  return {
    checked: true,
    preserved,
    sampleCount,
    avgDeltaE,
    message: preserved
      ? `Tone fidelity verified locally (avg ΔE ${avgDeltaE}).`
      : `Stylization shifted color tone noticeably (avg ΔE ${avgDeltaE}). Lower intensity or use Original.`,
  };
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function encodeCanvasSafely(canvas: HTMLCanvasElement, quality = 0.88): string {
  try {
    const webp = canvas.toDataURL('image/webp', quality);
    if (webp.startsWith('data:image/webp')) {
      return webp;
    }
  } catch {
    // Fallback to PNG
  }
  return canvas.toDataURL('image/png');
}

function resizeCanvasToBaked(source: HTMLCanvasElement, targetSize: number): string {
  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetSize;
  outCanvas.height = targetSize;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) return encodeCanvasSafely(source);
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(source, 0, 0, targetSize, targetSize);
  return encodeCanvasSafely(outCanvas, 0.88);
}

/**
 * Processes a student photograph 100% locally on the device using Canvas 2D + CIELAB color space:
 * - Renders at 512x512 full studio portrait and bakes a fast 256x256 deck thumbnail
 * - Smooths luminance (L*) gently while preserving original skin chromaticity (a*, b*)
 * - Never whitens, brightens, recolors, or globally quantizes skin tone
 * - Runs honest local Delta-E validation before reporting tone fidelity.
 */
export function processStudentPhotoLocally(
  img: HTMLImageElement,
  options: PhotoProcessOptions
): PhotoProcessResult {
  const size = 512;
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = size;
  baseCanvas.height = size;
  const ctx = baseCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Local 2D canvas processing is unavailable on this browser.');
  }

  ctx.save();
  if (options.backdropColor !== 'transparent') {
    ctx.fillStyle = options.backdropColor;
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.clearRect(0, 0, size, size);
  }

  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 48);
  ctx.clip();

  ctx.translate(size / 2, size / 2);
  ctx.rotate((options.rotationDeg * Math.PI) / 180);

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const minSide = Math.min(iw, ih);
  const scale = (size / minSide) * Math.max(1, options.zoom);
  const drawW = iw * scale;
  const drawH = ih * scale;
  const panLimitX = Math.max(0, (drawW - size) / 2);
  const panLimitY = Math.max(0, (drawH - size) / 2);

  ctx.drawImage(
    img,
    -drawW / 2 + options.offsetX * panLimitX,
    -drawH / 2 + options.offsetY * panLimitY,
    drawW,
    drawH
  );
  ctx.restore();

  const originalCroppedDataUrl = encodeCanvasSafely(baseCanvas, 0.9);
  const intensity = Math.max(1, Math.min(5, Math.round(options.cartoonIntensity)));

  const srcImage = ctx.getImageData(0, 0, size, size);
  const src = srcImage.data;
  const pixelCount = size * size;

  // Convert source buffer once to CIELAB arrays for edge-preserving L* smoothing
  const Lbuf = new Float32Array(pixelCount);
  const abuf = new Float32Array(pixelCount);
  const bbuf = new Float32Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 4;
    const lab = rgbToLab(src[idx], src[idx + 1], src[idx + 2]);
    Lbuf[i] = lab.L;
    abuf[i] = lab.a;
    bbuf[i] = lab.b;
  }

  const radius = intensity >= 4 ? 2 : 1;
  const rangeSigmaL = 9 + intensity * 3.2;
  const smoothL = new Float32Array(pixelCount);
  const smoothA = new Float32Array(pixelCount);
  const smoothB = new Float32Array(pixelCount);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = y * size + x;
      const L0 = Lbuf[p];
      const a0 = abuf[p];
      const b0 = bbuf[p];

      let sumL = 0;
      let sumA = 0;
      let sumB = 0;
      let sumW = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= size) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= size) continue;
          const np = ny * size + nx;
          const dist = Math.abs(Lbuf[np] - L0) + 0.6 * (Math.abs(abuf[np] - a0) + Math.abs(bbuf[np] - b0));
          const w = dist < rangeSigmaL * 2.2 ? 1 - dist / (rangeSigmaL * 2.5) : 0.04;
          sumL += Lbuf[np] * w;
          sumA += abuf[np] * w;
          sumB += bbuf[np] * w;
          sumW += w;
        }
      }

      smoothL[p] = sumL / sumW;
      // Blend toward exact original a*, b* chromaticity so skin undertone never shifts or whitens
      const chromaPreserve = 0.72;
      smoothA[p] = a0 * chromaPreserve + (sumA / sumW) * (1 - chromaPreserve);
      smoothB[p] = b0 * chromaPreserve + (sumB / sumW) * (1 - chromaPreserve);
    }
  }

  // Sobel edge ink lines computed strictly on L* luminance + soft L* tone stepping
  const lAt = (px: number, py: number) => {
    const cx = Math.max(0, Math.min(size - 1, px));
    const cy = Math.max(0, Math.min(size - 1, py));
    return smoothL[cy * size + cx];
  };

  const lLevels = Math.max(8, 20 - intensity * 2);
  const lStep = 100 / lLevels;
  const lBlend = 0.2 + intensity * 0.06; // Gentle tonal posterization on L* only
  const edgeThreshold = 42 - intensity * 4;
  const edgeStrength = 0.18 + intensity * 0.08;

  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = y * size + x;
      const idx = p * 4;

      const gx =
        -lAt(x - 1, y - 1) +
        lAt(x + 1, y - 1) -
        2 * lAt(x - 1, y) +
        2 * lAt(x + 1, y) -
        lAt(x - 1, y + 1) +
        lAt(x + 1, y + 1);
      const gy =
        -lAt(x - 1, y - 1) -
        2 * lAt(x, y - 1) -
        lAt(x + 1, y - 1) +
        lAt(x - 1, y + 1) +
        2 * lAt(x, y + 1) +
        lAt(x + 1, y + 1);
      const grad = Math.sqrt(gx * gx + gy * gy);

      const qL = Math.round(smoothL[p] / lStep) * lStep;
      let finalL = smoothL[p] * (1 - lBlend) + qL * lBlend;

      if (grad > edgeThreshold) {
        const inkFactor = Math.min(0.55, ((grad - edgeThreshold) / 110) * edgeStrength);
        finalL = finalL * (1 - inkFactor) + 12 * inkFactor;
      }

      const [r, g, b] = labToRgb(finalL, smoothA[p], smoothB[p]);
      out[idx] = r;
      out[idx + 1] = g;
      out[idx + 2] = b;
      out[idx + 3] = src[idx + 3];
    }
  }

  const validation = validateSkinToneBuffers(src, out, size, size);

  const outImage = new ImageData(out, size, size);
  ctx.putImageData(outImage, 0, 0);

  // Subtle warm hairline frame
  ctx.save();
  ctx.strokeStyle = 'rgba(35, 28, 22, 0.14)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(4, 4, size - 8, size - 8, 44);
  ctx.stroke();
  ctx.restore();

  const fullDataUrl = encodeCanvasSafely(baseCanvas, 0.9);
  const thumbnailDataUrl = resizeCanvasToBaked(baseCanvas, 256);

  return {
    cartoonDataUrl: fullDataUrl,
    fullDataUrl,
    thumbnailDataUrl,
    originalCroppedDataUrl,
    validation,
    width: size,
    height: size,
  };
}
