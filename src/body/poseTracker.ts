import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision';

/** WASM runtime location. Same pinned package version as the hand tracker. */
const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
/** Lightweight pose model hosted by Google. Fast enough for live video in most browsers. */
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/**
 * Loads the pose model for live video. Call once and reuse the landmarker.
 * @returns A PoseLandmarker that tracks one person.
 */
export async function createPoseLandmarker(): Promise<PoseLandmarker> {
  // The resolver fetches the WASM runtime that runs the model.
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
}

/**
 * Runs pose detection on the current video frame.
 * @param landmarker A ready PoseLandmarker.
 * @param video The live video element.
 * @param timestampMs Monotonic time in milliseconds.
 * @returns The pose result. Empty when no person is in frame.
 */
export function detectPose(
  landmarker: PoseLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): PoseLandmarkerResult {
  return landmarker.detectForVideo(video, timestampMs);
}
