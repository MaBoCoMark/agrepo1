import { emitTo, listen } from '@tauri-apps/api/event';
import { BenchmarkMetrics, computeMetrics } from '../../overlay/core/benchmark-recorder';

/**
 * ============================================================================
 * ⚡ Performance Benchmark Tool Module (Configurator)
 * ============================================================================
 *
 * Sequence:
 * 1. User clicks "Run Performance Benchmark" at timestamp T.
 * 2. Button is disabled immediately for ~13 seconds.
 * 3. 3-second warm-up countdown (T to T+3s).
 * 4. 10-second frame timing recording (T+3s to T+13s).
 * 5. At T+13s, benchmark completes and renders an interactive frametime graph
 *    and performance metric cards directly underneath the button.
 * ============================================================================
 */

let isRunningBenchmark = false;

export function initBenchmarkTool(): void {
  const runBtn = document.getElementById('btn-run-benchmark') as HTMLButtonElement | null;
  const btnText = document.getElementById('benchmark-btn-text');
  const statusBox = document.getElementById('benchmark-status-box');
  const resultsContainer = document.getElementById('benchmark-results-container');

  if (!runBtn) return;

  // Listen for benchmark completion from Overlay
  try {
    listen<{ metrics: BenchmarkMetrics }>('benchmark-completed', (e) => {
      onBenchmarkFinished(e.payload.metrics);
    });

    listen<{ state: string; delayRemainingMs?: number; timeRemainingMs?: number }>('benchmark-status', (e) => {
      if (statusBox) {
        if (e.payload.state === 'delay') {
          statusBox.textContent = `⏳ Warm-up delay... Starting in ${(e.payload.delayRemainingMs! / 1000).toFixed(1)}s`;
        } else if (e.payload.state === 'recording') {
          statusBox.textContent = `🔴 Recording frame timings... ${(e.payload.timeRemainingMs! / 1000).toFixed(1)}s remaining`;
        }
      }
    });
  } catch {
    // Standalone / browser preview mode fallback
  }

  runBtn.addEventListener('click', () => {
    if (isRunningBenchmark) return;
    startBenchmarkRun();
  });

  function startBenchmarkRun() {
    isRunningBenchmark = true;
    runBtn!.disabled = true;
    runBtn!.classList.add('btn-disabled');

    if (resultsContainer) {
      resultsContainer.style.display = 'none';
      resultsContainer.innerHTML = '';
    }

    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.textContent = '⏳ Warm-up delay... Starting in 3.0s';
    }

    // Trigger overlay benchmark via Tauri IPC
    try {
      emitTo('overlay', 'start-performance-benchmark');
    } catch {
      // Standalone mode
    }

    // Client-side timer sequence & fallback runner
    const startTime = performance.now();
    const delayDuration = 3000;
    const recordDuration = 10000;
    const totalDuration = delayDuration + recordDuration;

    const fallbackTimestamps: number[] = [];
    let localRafId: number | null = null;

    const localTick = (now: number) => {
      const elapsed = now - startTime;
      if (elapsed >= delayDuration && elapsed <= totalDuration) {
        fallbackTimestamps.push(now);
      }
      if (elapsed < totalDuration) {
        localRafId = requestAnimationFrame(localTick);
      }
    };
    localRafId = requestAnimationFrame(localTick);

    const intervalTimer = setInterval(() => {
      const elapsed = performance.now() - startTime;
      if (elapsed < delayDuration) {
        const rem = ((delayDuration - elapsed) / 1000).toFixed(1);
        if (btnText) btnText.textContent = `Starting in ${rem}s...`;
        if (statusBox) statusBox.textContent = `⏳ Warm-up delay... Starting in ${rem}s`;
      } else if (elapsed < totalDuration) {
        const rem = ((totalDuration - elapsed) / 1000).toFixed(1);
        if (btnText) btnText.textContent = `Recording (${rem}s)...`;
        if (statusBox) statusBox.textContent = `🔴 Recording frame timings... ${rem}s remaining`;
      } else {
        clearInterval(intervalTimer);
        if (localRafId) cancelAnimationFrame(localRafId);
        if (btnText) btnText.textContent = 'Analyzing...';
        if (statusBox) statusBox.textContent = '📊 Analyzing benchmark data...';

        // If overlay IPC didn't trigger completion within 500ms, use local metrics
        setTimeout(() => {
          if (isRunningBenchmark) {
            const metrics = computeMetrics(fallbackTimestamps);
            onBenchmarkFinished(metrics);
          }
        }, 500);
      }
    }, 100);
  }

  function onBenchmarkFinished(metrics: BenchmarkMetrics) {
    isRunningBenchmark = false;
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.classList.remove('btn-disabled');
    }
    if (btnText) btnText.textContent = '⚡ Run Performance Benchmark';
    if (statusBox) {
      statusBox.style.display = 'none';
    }

    renderBenchmarkResults(metrics);
  }

  function renderBenchmarkResults(metrics: BenchmarkMetrics) {
    if (!resultsContainer) return;
    resultsContainer.style.display = 'flex';
    resultsContainer.innerHTML = '';

    // 1. Metric Summary Cards
    const summaryCard = document.createElement('div');
    summaryCard.style.display = 'grid';
    summaryCard.style.gridTemplateColumns = 'repeat(4, 1fr)';
    summaryCard.style.gap = '8px';
    summaryCard.style.marginBottom = '8px';

    const createMetricItem = (title: string, value: string, color: string, sub?: string) => `
      <div style="background: var(--primer-canvas-subtle); border: 1px solid var(--primer-border-default); border-radius: 6px; padding: 6px 8px; text-align: center;">
        <div style="font-size: 10px; color: var(--primer-fg-muted); text-transform: uppercase;">${title}</div>
        <div style="font-size: 16px; font-weight: bold; color: ${color}; margin-top: 2px;">${value}</div>
        ${sub ? `<div style="font-size: 9px; color: var(--primer-fg-muted);">${sub}</div>` : ''}
      </div>
    `;

    const fpsColor = metrics.avgFps >= 100 ? '#2da44e' : metrics.avgFps >= 58 ? '#0969da' : '#cf222e';

    summaryCard.innerHTML = `
      ${createMetricItem('Avg FPS', `${metrics.avgFps}`, fpsColor, `Avg: ${metrics.avgFrameTimeMs}ms`)}
      ${createMetricItem('1% Low FPS', `${metrics.onePercentLowFps}`, '#0969da', `Min: ${metrics.minFps}`)}
      ${createMetricItem('99th % Frametime', `${metrics.p99FrameTimeMs}ms`, '#8250df', `Max: ${metrics.maxFrameTimeMs}ms`)}
      ${createMetricItem('Total Frames', `${metrics.frameCount}`, 'var(--primer-fg-default)', `${metrics.stuttersCount} stutters`)}
    `;

    resultsContainer.appendChild(summaryCard);

    // 2. Frametime Canvas Graph
    const graphContainer = document.createElement('div');
    graphContainer.style.background = 'var(--primer-canvas-subtle)';
    graphContainer.style.border = '1px solid var(--primer-border-default)';
    graphContainer.style.borderRadius = '6px';
    graphContainer.style.padding = '8px';
    graphContainer.style.display = 'flex';
    graphContainer.style.flexDirection = 'column';
    graphContainer.style.gap = '6px';

    const graphHeader = document.createElement('div');
    graphHeader.style.display = 'flex';
    graphHeader.style.justifyContent = 'space-between';
    graphHeader.style.alignItems = 'center';
    graphHeader.style.fontSize = '11px';
    graphHeader.style.fontWeight = 'bold';
    graphHeader.style.color = 'var(--primer-fg-default)';
    graphHeader.innerHTML = `
      <span>📈 Frame Times over 10s Window</span>
      <span style="font-size: 10px; font-weight: normal; color: var(--primer-fg-muted);">
        <span style="display:inline-block;width:8px;height:2px;background:#2da44e;vertical-align:middle;margin-right:2px;"></span> 8.33ms (120fps)
        <span style="display:inline-block;width:8px;height:2px;background:#0969da;vertical-align:middle;margin-right:2px;margin-left:6px;"></span> 16.67ms (60fps)
      </span>
    `;

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 180;
    canvas.style.width = '100%';
    canvas.style.height = '140px';
    canvas.style.display = 'block';
    canvas.style.borderRadius = '4px';

    drawFrametimeChart(canvas, metrics.frameDeltas);

    graphContainer.appendChild(graphHeader);
    graphContainer.appendChild(canvas);
    resultsContainer.appendChild(graphContainer);
  }

  function drawFrametimeChart(canvas: HTMLCanvasElement, deltas: number[]) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const paddingLeft = 35;
    const paddingRight = 10;
    const paddingTop = 15;
    const paddingBottom = 25;

    const plotW = w - paddingLeft - paddingRight;
    const plotH = h - paddingTop - paddingBottom;

    // Determine max Y scale (at least 20ms or 33.3ms)
    let maxY = 25.0;
    for (const d of deltas) {
      if (d > maxY) maxY = Math.min(60.0, d * 1.15);
    }

    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    // Guide lines
    const drawGuideLine = (targetMs: number, color: string, label: string) => {
      if (targetMs > maxY) return;
      const y = paddingTop + plotH - (targetMs / maxY) * plotH;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(w - paddingRight, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = color;
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(label, paddingLeft - 4, y + 3);
    };

    drawGuideLine(8.33, 'rgba(45, 164, 78, 0.7)', '8.3ms');
    drawGuideLine(16.67, 'rgba(9, 105, 218, 0.7)', '16.7ms');
    if (maxY >= 33.3) {
      drawGuideLine(33.33, 'rgba(207, 34, 46, 0.7)', '33.3ms');
    }

    // Zero line
    ctx.beginPath();
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.moveTo(paddingLeft, paddingTop + plotH);
    ctx.lineTo(w - paddingRight, paddingTop + plotH);
    ctx.stroke();

    // Plot frame delta line
    if (deltas.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#58a6ff';
      ctx.lineWidth = 1.5;

      const stepX = plotW / (deltas.length - 1);
      for (let i = 0; i < deltas.length; i++) {
        const val = Math.min(maxY, deltas[i]);
        const x = paddingLeft + i * stepX;
        const y = paddingTop + plotH - (val / maxY) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Highlight frame drops (> 20ms)
      for (let i = 0; i < deltas.length; i++) {
        if (deltas[i] > 20.0) {
          const x = paddingLeft + i * stepX;
          const y = paddingTop + plotH - (Math.min(maxY, deltas[i]) / maxY) * plotH;
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = '#f85149';
          ctx.fill();
        }
      }
    }

    // Time Axis Labels
    ctx.fillStyle = '#8b949e';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('0s', paddingLeft, h - 8);
    ctx.fillText('5s', paddingLeft + plotW / 2, h - 8);
    ctx.fillText('10s', w - paddingRight, h - 8);
  }
}
