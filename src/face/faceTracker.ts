import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';

/** WASM runtime location. Same pinned package version as the other trackers. */
const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
/** Face model hosted by Google. Produces 478 landmarks per face. */
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/**
 * Loads the face landmark model for live video. Call once and reuse the landmarker.
 * @returns A FaceLandmarker that tracks one face.
 */
export async function createFaceLandmarker(): Promise<FaceLandmarker> {
  // The resolver fetches the WASM runtime that runs the model.
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
  });
}

/**
 * Runs face detection on the current video frame.
 * @param landmarker A ready FaceLandmarker.
 * @param video The live video element.
 * @param timestampMs Monotonic time in milliseconds.
 * @returns The face result. Empty when no face is in frame.
 */
export function detectFace(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): FaceLandmarkerResult {
  return landmarker.detectForVideo(video, timestampMs);
}
