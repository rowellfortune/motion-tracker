import { useState } from 'react';
import MotionView, { type MotionStats } from './components/MotionView';
import type { MotionOptions } from './motion/motionCore';

/** Default detection settings. Tuned for a typical indoor webcam. */
const DEFAULT_OPTIONS: MotionOptions = {
  threshold: 25,
  learningRate: 0.05,
  minMotionPixels: 20,
};

/**
 * Top-level screen: live camera feed on the left, controls and stats on the right.
 * @returns The motion tracker layout.
 */
export default function App() {
  const [options, setOptions] = useState<MotionOptions>(DEFAULT_OPTIONS);
  const [showMask, setShowMask] = useState(false);
  const [showTrail, setShowTrail] = useState(true);
  const [showBody, setShowBody] = useState(true);
  const [showHands, setShowHands] = useState(true);
  const [stats, setStats] = useState<MotionStats>({ motionPercent: 0, fps: 0, hasMotion: false });

  /**
   * Updates one numeric setting while keeping the others unchanged.
   * @param key The setting to change.
   * @param value The new value from the slider.
   */
  const updateOption = (key: keyof MotionOptions, value: number) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  /** Restores the default settings. */
  const resetOptions = () => setOptions(DEFAULT_OPTIONS);

  return (
    <div className="app">
      <header className="header">
        <h1>Motion Tracker</h1>
        <span className={`status ${stats.hasMotion ? 'status-live' : ''}`}>
          {stats.hasMotion ? 'Motion detected' : 'Idle'}
        </span>
      </header>

      <main className="layout">
        <MotionView
          options={options}
          showMask={showMask}
          showTrail={showTrail}
          showBody={showBody}
          showHands={showHands}
          onStats={setStats}
        />

        <aside className="panel">
          <section className="card">
            <h2>Live</h2>
            <div className="metric">
              <span className="metric-value">{stats.motionPercent.toFixed(1)}%</span>
              <span className="metric-label">of frame moving</span>
            </div>
            <div className="metric">
              <span className="metric-value">{stats.fps}</span>
              <span className="metric-label">processing FPS</span>
            </div>
          </section>

          <section className="card">
            <h2>Settings</h2>
            <SliderRow
              label="Sensitivity (threshold)"
              hint="Lower catches subtle movement. Higher ignores flicker."
              min={5}
              max={80}
              step={1}
              value={options.threshold}
              onChange={(v) => updateOption('threshold', v)}
            />
            <SliderRow
              label="Background learning rate"
              hint="How fast the scene becomes the new normal."
              min={0.01}
              max={0.3}
              step={0.01}
              value={options.learningRate}
              onChange={(v) => updateOption('learningRate', v)}
            />
            <SliderRow
              label="Minimum moving pixels"
              hint="Filters out small specks of noise."
              min={1}
              max={300}
              step={1}
              value={options.minMotionPixels}
              onChange={(v) => updateOption('minMotionPixels', v)}
            />
            <button className="button" onClick={resetOptions}>Reset defaults</button>
          </section>

          <section className="card">
            <h2>Display</h2>
            <label className="toggle">
              <input type="checkbox" checked={showMask} onChange={(e) => setShowMask(e.target.checked)} />
              Show motion mask
            </label>
            <label className="toggle">
              <input type="checkbox" checked={showTrail} onChange={(e) => setShowTrail(e.target.checked)} />
              Show movement trail
            </label>
            <label className="toggle">
              <input type="checkbox" checked={showBody} onChange={(e) => setShowBody(e.target.checked)} />
              Show upper body stick figure
            </label>
            <label className="toggle">
              <input type="checkbox" checked={showHands} onChange={(e) => setShowHands(e.target.checked)} />
              Show hand skeleton
            </label>
          </section>
        </aside>
      </main>
    </div>
  );
}

/** Props for one labeled slider row. */
interface SliderRowProps {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

/**
 * A labeled range input with a hint and the current value.
 * @param props Slider bounds, current value and change handler.
 * @returns A form row for one numeric setting.
 */
function SliderRow({ label, hint, min, max, step, value, onChange }: SliderRowProps) {
  return (
    <div className="slider-row">
      <div className="slider-head">
        <span>{label}</span>
        <output>{Number.isInteger(step) ? value : value.toFixed(2)}</output>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <small>{hint}</small>
    </div>
  );
}
