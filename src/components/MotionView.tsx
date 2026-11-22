import { useEffect, useRef, useState } from 'react';
import type { HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { MotionTracker, toGrayscale, type MotionOptions, type Point } from '../motion/motionCore';
import { createHandLandmarker, detectHands } from '../hand/handTracker';
import { drawHandSkeleton } from '../hand/handSkeleton';
import { createPoseLandmarker, detectPose } from '../body/poseTracker';
import { drawBodySkeleton } from '../body/bodySkeleton';

/** Processing resolution. Smaller is faster; detection works well at this size. */
const PROC_WIDTH = 160;
const PROC_HEIGHT = 120;
/** How many past centroid positions to keep for the trail. */
const TRAIL_LENGTH = 60;
/** Send stats to the parent every N frames to avoid re-rendering on every frame. */
const STATS_EVERY_N_FRAMES = 6;
/** Colors for the stick figure and each hand. */
const BODY_COLOR = '#3ddc97';
const HAND_COLORS = ['#4bbdc5', '#ffb347'];

/** Live numbers shown in the sidebar. */
export interface MotionStats {
  motionPercent: number;
  fps: number;
  hasMotion: boolean;
}

/** Props for the camera view. */
interface MotionViewProps {
  options: MotionOptions;
  showMask: boolean;
  showTrail: boolean;
  showBody: boolean;
  showHands: boolean;
  onStats: (stats: MotionStats) => void;
}

/**
 * Shows the webcam feed with a motion overlay and an optional stick figure on top.
 * Owns the camera stream, the animation loop and the trackers.
 * @param props Detection settings, display toggles and a stats callback.
 */
export default function MotionView({
  options,
  showMask,
  showTrail,
  showBody,
  showHands,
  onStats,
}: MotionViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<string | null>(null);

  // Refs hold the latest props so the animation loop reads fresh values without restarting.
  const optionsRef = useRef(options);
  const showMaskRef = useRef(showMask);
  const showTrailRef = useRef(showTrail);
  const showBodyRef = useRef(showBody);
  const showHandsRef = useRef(showHands);
  const onStatsRef = useRef(onStats);
  optionsRef.current = options;
  showMaskRef.current = showMask;
  showTrailRef.current = showTrail;
  showBodyRef.current = showBody;
  showHandsRef.current = showHands;
  onStatsRef.current = onStats;

  useEffect(() => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    // Hidden canvas used only to read downscaled pixels from the video.
    const procCanvas = document.createElement('canvas');
    procCanvas.width = PROC_WIDTH;
    procCanvas.height = PROC_HEIGHT;
    const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });

    // Offscreen canvas that turns the binary mask into a colored image we can scale up.
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = PROC_WIDTH;
    maskCanvas.height = PROC_HEIGHT;
    const maskCtx = maskCanvas.getContext('2d');
    const overlayCtx = overlay.getContext('2d');

    const tracker = new MotionTracker(PROC_WIDTH, PROC_HEIGHT);
    const gray = new Float32Array(PROC_WIDTH * PROC_HEIGHT);
    const trail: Point[] = [];

    let stream: MediaStream | null = null;
    let frameId = 0;
    let cancelled = false;
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let fps = 0;

    // Model instances start as null and fill in once their downloads finish.
    let poseLandmarker: PoseLandmarker | null = null;
    let handLandmarker: HandLandmarker | null = null;

    /**
     * Draws the mask, box, centroid and trail onto the overlay for one frame.
     * @param result The latest motion result from the tracker.
     * @param scaleX Horizontal ratio from processing pixels to overlay pixels.
     * @param scaleY Vertical ratio from processing pixels to overlay pixels.
     */
    const drawMotion = (
      result: ReturnType<MotionTracker['process']>,
      scaleX: number,
      scaleY: number,
    ) => {
      if (!overlayCtx || !maskCtx) return;

      // Optional mask layer: paint moving pixels green, then stretch the small image over the overlay.
      if (showMaskRef.current) {
        const imageData = maskCtx.createImageData(PROC_WIDTH, PROC_HEIGHT);
        for (let i = 0; i < result.mask.length; i++) {
          if (result.mask[i]) {
            imageData.data[i * 4] = 0;
            imageData.data[i * 4 + 1] = 255;
            imageData.data[i * 4 + 2] = 120;
            imageData.data[i * 4 + 3] = 140;
          }
        }
        maskCtx.putImageData(imageData, 0, 0);
        overlayCtx.imageSmoothingEnabled = false;
        overlayCtx.drawImage(maskCanvas, 0, 0, overlay.width, overlay.height);
      }

      // Trail: older points fade out, newer points stay bright.
      if (showTrailRef.current && trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const alpha = i / trail.length;
          overlayCtx.strokeStyle = `rgba(255, 90, 60, ${alpha})`;
          overlayCtx.lineWidth = 3;
          overlayCtx.beginPath();
          overlayCtx.moveTo(trail[i - 1].x * scaleX, trail[i - 1].y * scaleY);
          overlayCtx.lineTo(trail[i].x * scaleX, trail[i].y * scaleY);
          overlayCtx.stroke();
        }
      }

      // Bounding box and centroid only when motion passed the filters.
      if (result.box && result.centroid) {
        const { box, centroid } = result;
        overlayCtx.strokeStyle = '#ff5a3c';
        overlayCtx.lineWidth = 3;
        overlayCtx.strokeRect(box.x * scaleX, box.y * scaleY, box.w * scaleX, box.h * scaleY);

        overlayCtx.fillStyle = '#ff5a3c';
        overlayCtx.beginPath();
        overlayCtx.arc(centroid.x * scaleX, centroid.y * scaleY, 6, 0, Math.PI * 2);
        overlayCtx.fill();

        // The stage is mirrored with CSS, so flip the label back to keep it readable.
        overlayCtx.font = '600 18px system-ui, sans-serif';
        overlayCtx.fillStyle = '#ff5a3c';
        overlayCtx.save();
        overlayCtx.translate(box.x * scaleX, Math.max(20, box.y * scaleY - 8));
        overlayCtx.scale(-1, 1);
        overlayCtx.fillText(`${(result.motionRatio * 100).toFixed(1)}% moving`, 0, 0);
        overlayCtx.restore();
      }
    };

    /**
     * Runs pose and hand detection on the video frame and draws the skeletons.
     * Skipped entirely when both toggles are off or the models are not loaded yet.
     * @param timestampMs Monotonic time in milliseconds for the model.
     */
    const drawSkeletons = (timestampMs: number) => {
      if (!overlayCtx) return;
      const width = overlay.width;
      const height = overlay.height;

      // Upper body: one person, drawn as a single stick figure.
      if (showBodyRef.current && poseLandmarker) {
        const pose = detectPose(poseLandmarker, video, timestampMs);
        const person = pose.landmarks[0];
        if (person) drawBodySkeleton(overlayCtx, person, width, height, BODY_COLOR);
      }

      // Hands: each detected hand gets its own color.
      if (showHandsRef.current && handLandmarker) {
        const hands = detectHands(handLandmarker, video, timestampMs);
        hands.landmarks.forEach((hand, index) => {
          drawHandSkeleton(overlayCtx, hand, width, height, HAND_COLORS[index % HAND_COLORS.length]);
        });
      }
    };

    /**
     * Runs once per animation frame: reads the video, detects motion, draws the overlay.
     * @param now High-resolution timestamp supplied by requestAnimationFrame.
     */
    const loop = (now: number) => {
      if (cancelled) return;

      // Wait until the video has real frame data before processing.
      if (procCtx && video.readyState >= 2 && video.videoWidth > 0) {
        // Keep the overlay the same pixel size as the video so the drawing lines up.
        if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
          overlay.width = video.videoWidth;
          overlay.height = video.videoHeight;
        }

        procCtx.drawImage(video, 0, 0, PROC_WIDTH, PROC_HEIGHT);
        const pixels = procCtx.getImageData(0, 0, PROC_WIDTH, PROC_HEIGHT);
        toGrayscale(pixels.data, gray);

        const result = tracker.process(gray, optionsRef.current);

        // Update the trail with the newest centroid, or let it fade out when motion stops.
        if (result.centroid) {
          trail.push(result.centroid);
          if (trail.length > TRAIL_LENGTH) trail.shift();
        } else if (trail.length > 0) {
          trail.shift();
        }

        // Clear once per frame, then draw the motion layer and the skeletons on top.
        overlayCtx?.clearRect(0, 0, overlay.width, overlay.height);
        drawMotion(result, overlay.width / PROC_WIDTH, overlay.height / PROC_HEIGHT);
        drawSkeletons(now);

        // Count frames per second once every second.
        frameCount++;
        if (now - lastFpsTime >= 1000) {
          fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
          frameCount = 0;
          lastFpsTime = now;
        }

        // Push stats to the parent only every few frames.
        if (frameCount % STATS_EVERY_N_FRAMES === 0) {
          onStatsRef.current({
            motionPercent: result.motionRatio * 100,
            fps,
            hasMotion: result.box !== null,
          });
        }
      }

      frameId = requestAnimationFrame(loop);
    };

    /**
     * Downloads the pose and hand models. Runs in the background so the camera and
     * motion detection start right away. A failure here only disables the skeletons.
     */
    const loadModels = async () => {
      try {
        setModelStatus('Loading body and hand models...');
        // Load both models in parallel to cut the wait.
        const [pose, hand] = await Promise.all([createPoseLandmarker(), createHandLandmarker()]);
        if (cancelled) {
          pose.close();
          hand.close();
          return;
        }
        poseLandmarker = pose;
        handLandmarker = hand;
        setModelStatus(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        setModelStatus(`Skeleton models failed to load: ${message}`);
      }
    };

    /**
     * Asks the browser for the webcam, attaches it to the video element and starts the loop.
     * Permission or device errors are shown to the user.
     */
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        // The component may have unmounted while the permission prompt was open.
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        frameId = requestAnimationFrame(loop);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown camera error';
        setError(`Could not access the camera: ${message}`);
      }
    };

    void start();
    void loadModels();

    // Cleanup: stop the loop, release the camera and free the model memory on unmount.
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach((t) => t.stop());
      poseLandmarker?.close();
      handLandmarker?.close();
    };
  }, []);

  return (
    <div className="stage">
      {error && <p className="error">{error}</p>}
      {modelStatus && <p className="notice">{modelStatus}</p>}
      <div className="stage-inner">
        {/* The video is mirrored with CSS so it feels like a mirror. The overlay mirrors too, so both line up. */}
        <video ref={videoRef} className="feed" playsInline muted />
        <canvas ref={overlayRef} className="overlay" />
      </div>
    </div>
  );
}
