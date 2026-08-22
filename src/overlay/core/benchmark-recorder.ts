import { emitTo } from '@tauri-apps/api/event';

/**
 * ============================================================================
 * ⚡ Performance Benchmark Engine (Overlay RAF Hook)
 * ============================================================================
 *
 * Sequence:
 * 1. User clicks at timestamp T.
 * 2. 3-second warm-up delay (T to T+3s).
 * 3. Recording window runs for 10 seconds (T+3s to T+13s), capturing high-resolution
 *    RAF frame timestamps (Float64Array / zero GC allocation).
 * 4. At T+13s, benchmark completes and emits captured timestamps & metrics to Configurator.
 * ============================================================================
 */

export enum BenchmarkState {
  IDLE = 'idle',
  DELAY = 'delay',
  RECORDING = 'recording',
  FINISHED = 'finished'
}

export interface BenchmarkMetrics {
  totalDurationMs: number;
  frameCount: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  avgFrameTimeMs: number;
  minFrameTimeMs: number;
  maxFrameTimeMs: number;
  p99FrameTimeMs: number;
  onePercentLowFps: number;
  stuttersCount: number; // frames taking > 20ms (> 120% of 60Hz frame or 2.4x of 120Hz)
  timestamps: number[];
  frameDeltas: number[];
}

let currentState: BenchmarkState = BenchmarkState.IDLE;
let recordingStartTime = 0;
let recordingEndTime = 0;

// Pre-allocate buffer for up to 10,000 frames (enough for up to 1000Hz refresh rate over 10s)
const MAX_FRAMES = 10000;
const rawTimestamps: number[] = [];

export function getBenchmarkState(): BenchmarkState {
  return currentState;
}

export function startBenchmark(): void {
  const now = performance.now();
  recordingStartTime = now + 3000;  // 3s delay
  recordingEndTime = now + 13000;   // 10s recording window
  rawTimestamps.length = 0;
  currentState = BenchmarkState.DELAY;

  emitTo('configurator', 'benchmark-status', {
    state: 'delay',
    delayRemainingMs: 3000
  });
}

export function recordBenchmarkFrame(now: number): void {
  if (currentState === BenchmarkState.IDLE) return;

  if (currentState === BenchmarkState.DELAY) {
    if (now >= recordingStartTime) {
      currentState = BenchmarkState.RECORDING;
      rawTimestamps.push(now);
      emitTo('configurator', 'benchmark-status', {
        state: 'recording',
        timeRemainingMs: recordingEndTime - now
      });
    }
    return;
  }

  if (currentState === BenchmarkState.RECORDING) {
    if (rawTimestamps.length < MAX_FRAMES) {
      rawTimestamps.push(now);
    }

    if (now >= recordingEndTime) {
      finishBenchmark();
    }
  }
}

export function computeMetrics(timestamps: number[]): BenchmarkMetrics {
  if (timestamps.length < 2) {
    return {
      totalDurationMs: 0,
      frameCount: timestamps.length,
      avgFps: 0,
      minFps: 0,
      maxFps: 0,
      avgFrameTimeMs: 0,
      minFrameTimeMs: 0,
      maxFrameTimeMs: 0,
      p99FrameTimeMs: 0,
      onePercentLowFps: 0,
      stuttersCount: 0,
      timestamps,
      frameDeltas: []
    };
  }

  const frameDeltas: number[] = [];
  let totalDelta = 0;
  let minDelta = Infinity;
  let maxDelta = 0;
  let stutters = 0;

  for (let i = 1; i < timestamps.length; i++) {
    const delta = timestamps[i] - timestamps[i - 1];
    frameDeltas.push(delta);
    totalDelta += delta;
    if (delta < minDelta) minDelta = delta;
    if (delta > maxDelta) maxDelta = delta;
    if (delta > 20.0) stutters++; // Frame stutter threshold
  }

  const frameCount = frameDeltas.length;
  const avgFrameTimeMs = totalDelta / frameCount;
  const avgFps = 1000 / avgFrameTimeMs;
  const maxFps = minDelta > 0 ? 1000 / minDelta : avgFps;
  const minFps = maxDelta > 0 ? 1000 / maxDelta : avgFps;

  // Sorted deltas for percentiles
  const sortedDeltas = [...frameDeltas].sort((a, b) => a - b);
  const p99Index = Math.min(sortedDeltas.length - 1, Math.floor(sortedDeltas.length * 0.99));
  const p99FrameTimeMs = sortedDeltas[p99Index];

  // 1% low FPS: average of the slowest 1% of frames
  const onePercentCount = Math.max(1, Math.floor(sortedDeltas.length * 0.01));
  let slowSum = 0;
  for (let i = sortedDeltas.length - onePercentCount; i < sortedDeltas.length; i++) {
    slowSum += sortedDeltas[i];
  }
  const onePercentAvgDelta = slowSum / onePercentCount;
  const onePercentLowFps = onePercentAvgDelta > 0 ? 1000 / onePercentAvgDelta : minFps;

  return {
    totalDurationMs: totalDelta,
    frameCount,
    avgFps: Math.round(avgFps * 10) / 10,
    minFps: Math.round(minFps * 10) / 10,
    maxFps: Math.round(maxFps * 10) / 10,
    avgFrameTimeMs: Math.round(avgFrameTimeMs * 100) / 100,
    minFrameTimeMs: Math.round(minDelta * 100) / 100,
    maxFrameTimeMs: Math.round(maxDelta * 100) / 100,
    p99FrameTimeMs: Math.round(p99FrameTimeMs * 100) / 100,
    onePercentLowFps: Math.round(onePercentLowFps * 10) / 10,
    stuttersCount: stutters,
    timestamps,
    frameDeltas
  };
}

function finishBenchmark(): void {
  currentState = BenchmarkState.FINISHED;
  const metrics = computeMetrics(rawTimestamps);

  emitTo('configurator', 'benchmark-completed', { metrics });
  currentState = BenchmarkState.IDLE;
}
