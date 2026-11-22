import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';

/** Where the MediaPipe WASM runtime is served from. Pinned to the installed package version. */
const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
/** Hand model file hosted by Google. Downloaded once by the browser. */
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

/**
 * Loads the hand landmark model and prepares it for video input.
 * Call once; reuse the returned landmarker for every frame.
 * @returns A ready HandLandmarker configured for live video, tracking up to two hands.
 */
export async function createHandLandmarker(): Promise<HandLandmarker> {
  // The resolver fetches the WASM runtime that does the actual inference.
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
  });
}

/**
 * Runs hand detection on the current video frame.
 * @param landmarker A ready HandLandmarker from createHandLandmarker.
 * @param video The live video element.
 * @param timestampMs Monotonic time in milliseconds. The model requires increasing values.
 * @returns The detection result, containing landmarks for each detected hand.
 */
export function detectHands(
  landmarker: HandLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): HandLandmarkerResult {
  return landmarker.detectForVideo(video, timestampMs);
}
