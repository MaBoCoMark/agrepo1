import { previousData, latestData, overlayState } from './telemetry-state';
import { getDevDashboardCache } from './dom-cache';
import { updateMockStream } from './mock-stream';
import { recordBenchmarkFrame } from './benchmark-recorder';
import { loadLayers, switchSceneMode, switchRefMode } from './scene-manager';
import { setupOverlayEventListeners } from './event-bridge';
import { connectWebSocket } from './websocket-manager';
import { renderDevDashboard } from './dev-dashboard-renderer';
import { renderCompetitiveSceneSelective } from './competitive-renderer';

/**
 * ============================================================================
 * 🏎️ High-Frequency Animation Tick Loop (@ 120Hz - 360Hz+)
 * ============================================================================
 *
 * Performance Architecture:
 * 1. Zero full-state dirty checking loops.
 * 2. Property selective change check:
 *    if (previousData.prop !== latestData.prop) {
 *      // update corresponding components, then
 *      previousData.prop = latestData.prop;
 *    }
 * 3. Unchanged properties skip both DOM updates and assignment overhead.
 * 4. Zero layout computation triggers in hot paths.
 * ============================================================================
 */
function tick(now: number): void {
  // 1. Log benchmark frame timestamp if recording
  recordBenchmarkFrame(now);

  // 2. Step mock physics simulation if enabled
  if (overlayState.isSimulating) {
    updateMockStream(latestData);
  }

  // 3. Developer Dashboard Scene Renderer
  if (overlayState.isDevDashboardVisible) {
    const devDom = getDevDashboardCache();
    if (devDom) {
      renderDevDashboard(latestData, previousData, devDom);
    }
  }

  // 4. Competitive Scene HUD Renderer (Selective Property Dispatch)
  if (overlayState.isCompetitiveVisible) {
    renderCompetitiveSceneSelective(latestData, previousData);
  }

  // 5. Schedule next animation frame
  requestAnimationFrame(tick);
}

/**
 * Bootstrap low-frequency overlay subsystems
 */
async function bootstrap(): Promise<void> {
  try {
    await loadLayers();
    await setupOverlayEventListeners();
    switchRefMode('empty');
    switchSceneMode('not-connected');
    connectWebSocket();
    requestAnimationFrame(tick);
  } catch (err) {
    console.error('Failed to bootstrap overlay:', err);
    requestAnimationFrame(tick);
  }
}

if (typeof window !== 'undefined') {
  bootstrap();
}
