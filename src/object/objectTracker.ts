import { FilesetResolver, ObjectDetector, type Detection } from '@mediapipe/tasks-vision';

/** WASM runtime location. Same pinned package version as the other trackers. */
const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
/** EfficientDet-Lite0 model hosted by Google. Detects 80 everyday object classes (COCO). */
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';

/**
 * Loads the object detection model for live video. Call once and reuse the detector.
 * @returns An ObjectDetector that returns up to 5 objects per frame above a score threshold.
 */
export async function createObjectDetector(): Promise<ObjectDetector> {
  // The resolver fetches the WASM runtime that runs the model.
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  return ObjectDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    maxResults: 5,
    scoreThreshold: 0.4,
  });
}

/**
 * Runs object detection on the current video frame.
 * @param detector A ready ObjectDetector.
 * @param video The live video element.
 * @param timestampMs Monotonic time in milliseconds.
 * @returns The list of detected objects for this frame.
 */
export function detectObjects(
  detector: ObjectDetector,
  video: HTMLVideoElement,
  timestampMs: number,
): Detection[] {
  return detector.detectForVideo(video, timestampMs).detections;
}
