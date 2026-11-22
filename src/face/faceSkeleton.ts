import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Landmark loops that outline the main face features, using the MediaPipe face mesh indices.
 * Each loop is drawn as a closed line. The first group is the face oval.
 */
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];
/** Left eye outline. */
const LEFT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
/** Right eye outline. */
const RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
/** Outer lip outline. */
const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];

/** Feature loops to draw, with a line width for each. */
const FEATURES: ReadonlyArray<{ indices: number[]; width: number }> = [
  { indices: FACE_OVAL, width: 2 },
  { indices: LEFT_EYE, width: 2 },
  { indices: RIGHT_EYE, width: 2 },
  { indices: LIPS, width: 2 },
];

/**
 * Draws a face outline with eyes and lips as closed loops.
 * Landmarks are normalized (0 to 1), so they are scaled to the canvas size here.
 * @param ctx Canvas context to draw on.
 * @param landmarks The face landmarks for one face.
 * @param width Canvas width in pixels.
 * @param height Canvas height in pixels.
 * @param color Stroke color for the face.
 */
export function drawFaceSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';

  for (const feature of FEATURES) {
    ctx.lineWidth = feature.width;
    ctx.beginPath();
    feature.indices.forEach((index, step) => {
      const point = landmarks[index];
      if (!point) return;
      const x = point.x * width;
      const y = point.y * height;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }
}
