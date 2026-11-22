import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Pairs of landmark indices that form the bones of the hand.
 * Indices follow the MediaPipe hand model: 0 is the wrist, 1-4 thumb, 5-8 index,
 * 9-12 middle, 13-16 ring, 17-20 pinky.
 */
export const HAND_BONES: ReadonlyArray<readonly [number, number]> = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

/**
 * Draws one hand as a stick figure: lines for bones and dots for joints.
 * Landmarks are normalized (0 to 1), so they are scaled to the canvas size here.
 * @param ctx Canvas context to draw on.
 * @param landmarks The 21 hand landmarks for one hand.
 * @param width Canvas width in pixels.
 * @param height Canvas height in pixels.
 * @param color Stroke and fill color for this hand.
 */
export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
  color: string,
): void {
  // Bones first, so the joint dots sit on top of the lines.
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const [a, b] of HAND_BONES) {
    const p = landmarks[a];
    const q = landmarks[b];
    ctx.beginPath();
    ctx.moveTo(p.x * width, p.y * height);
    ctx.lineTo(q.x * width, q.y * height);
    ctx.stroke();
  }

  // Joints: a dot at every landmark. The wrist gets a larger dot.
  ctx.fillStyle = color;
  landmarks.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, index === 0 ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();
  });
}
