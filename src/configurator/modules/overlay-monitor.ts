import { listen } from '@tauri-apps/api/event';

/**
 * ============================================================================
 * 🖥️ Display Metrics & Overlay Monitor
 * ============================================================================
 */

export async function initOverlayMonitor(): Promise<void> {
  const overlayMetricsEl = document.getElementById('overlay-metrics');
  try {
    await listen<[number, number, number, number, number]>('overlay-metrics', (event) => {
      const [pWidth, pHeight, scale, lWidth, lHeight] = event.payload;
      if (overlayMetricsEl) {
        overlayMetricsEl.textContent = `${pWidth}x${pHeight} (${Math.round(scale * 100)}%) [${lWidth}x${lHeight}]`;
      }
    });
  } catch (err) {
    console.error('Failed to listen to overlay-metrics:', err);
  }
}
