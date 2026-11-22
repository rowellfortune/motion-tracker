import type { Detection } from '@mediapipe/tasks-vision';

/**
 * Draws a labeled box around each detected object.
 * Detection boxes are in video pixels, which match the overlay canvas size, so no scaling is needed.
 * @param ctx Canvas context to draw on.
 * @param detections Objects found in the current frame.
 * @param color Stroke color for the boxes.
 */
export function drawObjectBoxes(
  ctx: CanvasRenderingContext2D,
  detections: Detection[],
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.textBaseline = 'top';

  for (const detection of detections) {
    const box = detection.boundingBox;
    const top = detection.categories[0];
    if (!box || !top) continue;

    ctx.strokeRect(box.originX, box.originY, box.width, box.height);

    // Label sits above the box, with the score as a percentage.
    const label = `${top.categoryName} ${Math.round(top.score * 100)}%`;
    // The stage is mirrored with CSS, so flip the label back to keep it readable.
    ctx.save();
    ctx.translate(box.originX, Math.max(0, box.originY - 22));
    ctx.scale(-1, 1);
    ctx.fillText(label, -ctx.measureText(label).width, 0);
    ctx.restore();
  }
}
