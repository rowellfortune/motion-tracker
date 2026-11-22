/**
 * Motion detection core. Pure TypeScript, no DOM access, so it can be tested in isolation.
 *
 * Pipeline per frame:
 *   1. Convert RGBA pixels to grayscale luma.
 *   2. Compare each pixel to a running background model.
 *   3. Update the background slowly so the model adapts to lighting changes.
 *   4. Drop isolated noisy pixels with a neighbour check.
 *   5. Measure the bounding box and centroid of what moved.
 */

/** A 2D point in processing-canvas pixel coordinates. */
export interface Point {
  x: number;
  y: number;
}

/** An axis-aligned rectangle in processing-canvas pixel coordinates. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tunable parameters that the UI can change while the loop runs. */
export interface MotionOptions {
  /** Minimum gray-level difference (0-255) for a pixel to count as changed. */
  threshold: number;
  /** How fast the background adapts per frame (0-1). Higher means faster adaptation. */
  learningRate: number;
  /** Minimum number of changed pixels before we report motion at all. */
  minMotionPixels: number;
}

/** Result of processing a single frame. */
export interface MotionFrameResult {
  /** Share of the frame that moved, from 0 to 1. */
  motionRatio: number;
  /** Bounding box around the moving pixels, or null when no motion passed the filters. */
  box: Box | null;
  /** Average position of the moving pixels, or null when no motion passed the filters. */
  centroid: Point | null;
  /** Cleaned binary mask (1 = moving). Length is width * height. */
  mask: Uint8Array;
}

/**
 * Converts RGBA pixel data into grayscale luma values using Rec. 601 weights.
 * Writes into the provided buffer so no new memory is allocated every frame.
 * @param rgba Source pixels in RGBA order, four bytes per pixel.
 * @param out Destination buffer with one float per pixel.
 */
export function toGrayscale(rgba: Uint8ClampedArray, out: Float32Array): void {
  // Walk the pixel array four bytes at a time: R, G, B, A.
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  }
}

/**
 * Stateful motion tracker. Keep one instance per video stream.
 * It remembers the background between frames, so create it once and reuse it.
 */
export class MotionTracker {
  /** Width of the frames this tracker processes. */
  private readonly width: number;
  /** Height of the frames this tracker processes. */
  private readonly height: number;
  /** Running average of past frames. Null until the first frame arrives. */
  private background: Float32Array | null = null;
  /** Raw per-pixel changed flags before noise filtering. */
  private readonly rawMask: Uint8Array;
  /** Final mask after noise filtering. Returned to the caller. */
  private readonly cleanMask: Uint8Array;

  /**
   * Allocates the buffers used on every frame.
   * @param width Processing frame width in pixels.
   * @param height Processing frame height in pixels.
   */
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.rawMask = new Uint8Array(width * height);
    this.cleanMask = new Uint8Array(width * height);
  }

  /** Forgets the background model so the next frame starts a fresh baseline. */
  reset(): void {
    this.background = null;
  }

  /**
   * Processes one grayscale frame and reports what moved.
   * @param gray Grayscale frame, one float per pixel.
   * @param options Current detection settings from the UI.
   * @returns Motion ratio, bounding box, centroid and the cleaned mask.
   */
  process(gray: Float32Array, options: MotionOptions): MotionFrameResult {
    // First frame: nothing to compare against, so store it as the background and report no motion.
    if (!this.background) {
      this.background = gray.slice();
      return this.emptyResult();
    }

    const bg = this.background;
    const { threshold, learningRate } = options;
    const total = this.width * this.height;

    // Step 1 and 2: compare each pixel to the background, then nudge the background toward the new frame.
    for (let i = 0; i < total; i++) {
      const diff = Math.abs(gray[i] - bg[i]);
      this.rawMask[i] = diff > threshold ? 1 : 0;
      bg[i] += (gray[i] - bg[i]) * learningRate;
    }

    // Step 3: keep a pixel only when at least 3 of its 8 neighbours also changed.
    // This removes single-pixel sensor noise and keeps real moving regions.
    let changedCount = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = y * this.width + x;
        // Pixels that did not change can never be part of a moving region.
        if (this.rawMask[idx] === 0) {
          this.cleanMask[idx] = 0;
          continue;
        }
        const neighbours = this.countChangedNeighbours(x, y);
        const keep = neighbours >= 3 ? 1 : 0;
        this.cleanMask[idx] = keep;
        changedCount += keep;
      }
    }

    // Step 4: too few pixels means the change is noise, not motion.
    if (changedCount < options.minMotionPixels) {
      this.cleanMask.fill(0);
      return { motionRatio: 0, box: null, centroid: null, mask: this.cleanMask };
    }

    // Step 5: measure where the moving pixels are.
    const { box, centroid } = this.measureRegion();

    return {
      motionRatio: changedCount / total,
      box,
      centroid,
      mask: this.cleanMask,
    };
  }

  /**
   * Counts how many of the 8 neighbours of a pixel are flagged as changed in the raw mask.
   * Pixels on the edge of the frame treat missing neighbours as unchanged.
   * @param x Column of the pixel.
   * @param y Row of the pixel.
   * @returns Number of changed neighbours, from 0 to 8.
   */
  private countChangedNeighbours(x: number, y: number): number {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue; // Skip the pixel itself.
        const nx = x + dx;
        const ny = y + dy;
        // Ignore neighbours outside the frame.
        if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue;
        count += this.rawMask[ny * this.width + nx];
      }
    }
    return count;
  }

  /**
   * Scans the clean mask once and returns the bounding box and centroid of all moving pixels.
   * @returns The box and centroid of the moving region.
   */
  private measureRegion(): { box: Box; centroid: Point } {
    let minX = this.width;
    let minY = this.height;
    let maxX = -1;
    let maxY = -1;
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.cleanMask[y * this.width + x] === 0) continue;
        // Expand the box to include this moving pixel.
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sumX += x;
        sumY += y;
        count++;
      }
    }

    return {
      box: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
      centroid: { x: sumX / count, y: sumY / count },
    };
  }

  /**
   * Builds the result returned when there is no motion to report.
   * @returns A result with zero motion and an empty mask.
   */
  private emptyResult(): MotionFrameResult {
    return {
      motionRatio: 0,
      box: null,
      centroid: null,
      mask: new Uint8Array(this.width * this.height),
    };
  }
}
