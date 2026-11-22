import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/** Minimum visibility score (0 to 1) for a landmark to be used. */
const MIN_VISIBILITY = 0.5;

/**
 * One approximate muscle: an ellipse laid along a bone segment between two joints.
 * Offset moves the ellipse sideways from the bone, as a fraction of the bone length.
 * Thickness is the ellipse half-height, as a fraction of the bone length.
 */
interface MuscleSpec {
  name: string;
  from: number;
  to: number;
  offset: number;
  thickness: number;
}

/**
 * Approximate muscle placement using MediaPipe pose indices.
 * These are visual estimates placed along the bones, not measurements of real anatomy.
 * 11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips, 25/26 knees, 27/28 ankles.
 */
const MUSCLES: MuscleSpec[] = [
  // Arms
  { name: 'biceps', from: 11, to: 13, offset: -0.05, thickness: 0.16 },
  { name: 'biceps', from: 12, to: 14, offset: 0.05, thickness: 0.16 },
  { name: 'triceps', from: 11, to: 13, offset: 0.08, thickness: 0.14 },
  { name: 'triceps', from: 12, to: 14, offset: -0.08, thickness: 0.14 },
  { name: 'forearm', from: 13, to: 15, offset: 0, thickness: 0.12 },
  { name: 'forearm', from: 14, to: 16, offset: 0, thickness: 0.12 },
  // Legs
  { name: 'quadriceps', from: 23, to: 25, offset: 0, thickness: 0.2 },
  { name: 'quadriceps', from: 24, to: 26, offset: 0, thickness: 0.2 },
  { name: 'calf', from: 25, to: 27, offset: 0.02, thickness: 0.16 },
  { name: 'calf', from: 26, to: 28, offset: 0.02, thickness: 0.16 },
];

/** Colors by muscle group, so each group reads as one region. */
const COLORS: Record<string, string> = {
  biceps: 'rgba(255, 99, 132, 0.45)',
  triceps: 'rgba(255, 159, 64, 0.45)',
  forearm: 'rgba(255, 205, 86, 0.45)',
  quadriceps: 'rgba(75, 192, 192, 0.45)',
  calf: 'rgba(54, 162, 235, 0.45)',
  chest: 'rgba(153, 102, 255, 0.4)',
  deltoid: 'rgba(255, 90, 60, 0.4)',
  core: 'rgba(201, 203, 207, 0.35)',
};

/**
 * Draws one ellipse along the bone between two landmarks.
 * @param ctx Canvas context to draw on.
 * @param p Start landmark in normalized coordinates.
 * @param q End landmark in normalized coordinates.
 * @param spec Placement and thickness of the muscle.
 * @param width Canvas width in pixels.
 * @param height Canvas height in pixels.
 */
function drawBoneMuscle(
  ctx: CanvasRenderingContext2D,
  p: NormalizedLandmark,
  q: NormalizedLandmark,
  spec: MuscleSpec,
  width: number,
  height: number,
): void {
  // Work in pixel space so lengths and angles match the real frame.
  const x1 = p.x * width;
  const y1 = p.y * height;
  const x2 = q.x * width;
  const y2 = q.y * height;
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 1) return;

  // Unit vector along the bone and the normal pointing to its side.
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);

  // Center sits on the bone midpoint, shifted sideways by the offset.
  const shift = spec.offset * length;
  const cx = (x1 + x2) / 2 + nx * shift;
  const cy = (y1 + y2) / 2 + ny * shift;

  ctx.beginPath();
  ctx.ellipse(cx, cy, length * 0.45, length * spec.thickness, angle, 0, Math.PI * 2);
  ctx.fillStyle = COLORS[spec.name] ?? 'rgba(255, 255, 255, 0.3)';
  ctx.fill();
}

/**
 * Draws the approximate muscle overlay for one person.
 * Skips any muscle whose joints are not clearly visible.
 * @param ctx Canvas context to draw on.
 * @param landmarks The 33 pose landmarks for one person.
 * @param width Canvas width in pixels.
 * @param height Canvas height in pixels.
 */
export function drawMuscleOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  width: number,
  height: number,
): void {
  const visible = (p: NormalizedLandmark | undefined): p is NormalizedLandmark =>
    !!p && (p.visibility ?? 1) >= MIN_VISIBILITY;

  // Bone-based muscles first.
  for (const spec of MUSCLES) {
    const p = landmarks[spec.from];
    const q = landmarks[spec.to];
    if (!visible(p) || !visible(q)) continue;
    drawBoneMuscle(ctx, p, q, spec, width, height);
  }

  // Chest: a wide ellipse between the shoulders and the hips' midline.
  const ls = landmarks[11];
  const rs = landmarks[12];
  const lh = landmarks[23];
  const rh = landmarks[24];
  if (visible(ls) && visible(rs) && visible(lh) && visible(rh)) {
    const topX = ((ls.x + rs.x) / 2) * width;
    const topY = ((ls.y + rs.y) / 2) * height;
    const botX = ((lh.x + rh.x) / 2) * width;
    const botY = ((lh.y + rh.y) / 2) * height;
    const cx = (topX + botX) / 2;
    const cy = (topY + botY) / 2 - (botY - topY) * 0.1;
    const shoulderWidth = Math.hypot((ls.x - rs.x) * width, (ls.y - rs.y) * height);
    const torsoLength = Math.hypot(botX - topX, botY - topY);
    ctx.beginPath();
    ctx.ellipse(cx, cy, shoulderWidth * 0.5, torsoLength * 0.22, Math.atan2(botY - topY, botX - topX) - Math.PI / 2, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.chest;
    ctx.fill();

    // Core: a narrower band down the center of the torso.
    ctx.beginPath();
    ctx.ellipse(cx, cy + torsoLength * 0.1, shoulderWidth * 0.2, torsoLength * 0.3, Math.atan2(botY - topY, botX - topX) - Math.PI / 2, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.core;
    ctx.fill();
  }

  // Deltoids: a cap over each shoulder joint.
  for (const index of [11, 12]) {
    const shoulder = landmarks[index];
    const elbow = landmarks[index + 2];
    if (!visible(shoulder) || !visible(elbow)) continue;
    const length = Math.hypot((elbow.x - shoulder.x) * width, (elbow.y - shoulder.y) * height);
    ctx.beginPath();
    ctx.arc(shoulder.x * width, shoulder.y * height, length * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.deltoid;
    ctx.fill();
  }
}
