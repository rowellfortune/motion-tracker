import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Upper-body bones using MediaPipe pose indices.
 * 0 nose, 11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips.
 * Hips are included so the torso closes into a full frame.
 */
const UPPER_BODY_BONES: ReadonlyArray<readonly [number, number]> = [
  [11, 12], // Shoulder line
  [11, 23], [12, 24], // Torso sides
  [23, 24], // Hip line
  [11, 13], [13, 15], // Left arm
  [12, 14], [14, 16], // Right arm
];

/** Landmark index of the nose, used to place the head. */
const NOSE = 0;
/** Landmark indices of the two shoulders. Their distance sets the head size. */
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
/** Minimum visibility score (0 to 1) for a landmark to be drawn. */
const MIN_VISIBILITY = 0.5;

/**
 * Draws the upper body as a stick figure: head, torso, and both arms.
 * Landmarks are normalized (0 to 1), so they are scaled to the canvas here.
 * @param ctx Canvas context to draw on.
 * @param landmarks The 33 pose landmarks for one person.
 * @param width Canvas width in pixels.
 * @param height Canvas height in pixels.
 * @param color Stroke color for the figure.
 */
export function drawBodySkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  color: string,
): void {
  const visible = (p: NormalizedLandmark | undefined): p is NormalizedLandmark =>
    !!p && (p.visibility ?? 1) >= MIN_VISIBILITY;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';

  // Bones: skip any bone whose end is not clearly visible.
  for (const [a, b] of UPPER_BODY_BONES) {
    const p = landmarks[a];
    const q = landmarks[b];
    if (!visible(p) || !visible(q)) continue;
    ctx.beginPath();
    ctx.moveTo(p.x * width, p.y * height);
    ctx.lineTo(q.x * width, q.y * height);
    ctx.stroke();
  }

  // Joints: a dot on each shoulder, elbow, and wrist.
  for (const index of [LEFT_SHOULDER, RIGHT_SHOULDER, 13, 14, 15, 16]) {
    const p = landmarks[index];
    if (!visible(p)) continue;
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head: a circle centred on the nose. Its radius is a fraction of the shoulder width.
  const nose = landmarks[NOSE];
  const leftShoulder = landmarks[LEFT_SHOULDER];
  const rightShoulder = landmarks[RIGHT_SHOULDER];
  if (visible(nose) && visible(leftShoulder) && visible(rightShoulder)) {
    const dx = (leftShoulder.x - rightShoulder.x) * width;
    const dy = (leftShoulder.y - rightShoulder.y) * height;
    const shoulderWidth = Math.hypot(dx, dy);
    ctx.beginPath();
    ctx.arc(nose.x * width, nose.y * height, shoulderWidth * 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
}
