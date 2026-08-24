import { listen } from '@tauri-apps/api/event';
import { ComponentInstance, GlobalLayoutSettings } from './component-types';
import { saveCompetitiveLayout, saveGlobalLayoutSettings, loadGlobalLayoutSettings } from './layout-store';
import { overlayState, setOverlayClickThrough } from './telemetry-state';
import {
  switchRefMode,
  switchSceneMode,
  updateDimensions,
  getDragger,
  setCompetitiveInstances,
  renderCompetitiveScene,
  getCompetitiveInstances
} from './scene-manager';
import {
  setWsConfig,
  connectWebSocket,
  disconnectWebSocket,
  setCaptureRequested,
  setCaptureTargetEvents,
  setAutoRetryDisabled,
  setTimelineCaptureState,
  setTimelineCaptureEvents,
  setLowFreqTriggerEvents,
  requestLowFrequencySync,
  notifyWsStatus,
  initMockData
} from './websocket-manager';
import {
  setReplayTransitionDuration,
  enterReplayView,
  willEndReplayView,
  immediateEndReplayView
} from './replay-controller';
import { startBenchmark } from './benchmark-recorder';
import { getCompetitiveDomCache, applyStaticComponentStyles } from './dom-cache';
import { updateOverlayGlobalSettings, applyAutoHideNonExistingPlayers } from './competitive-renderer';
import {
  updateCalibration,
  updateControlPoints,
  setOperationMode,
  setRecordingState,
  clearHitHistory,
  clearBoostHistory,
  clearAllPitchData,
  importHitsFromJson,
  importBoostsFromJson,
  markBallHitDirty,
  setOnlyLatestHit,
  setSpeedRingPercent,
  setTargetTeam,
  setPreviewSpeedRing,
  setPreviewSpeedKph,
  BallHitOperationMode
} from './ball-hit-tracker';
import { CalibrationSettings, ControlPoint } from './pitch-geometry';

/**
 * ============================================================================
 * 🌉 Tauri IPC / Configurator Event Bridge
 * ============================================================================
 */

export async function setupOverlayEventListeners(): Promise<void> {
  // 1. Reference & Scene Modes
  await listen<any>('change-ref-layer', (e) => {
    const mode = typeof e.payload === 'string' ? e.payload : e.payload?.mode;
    if (mode) switchRefMode(mode);
  });

  await listen<any>('change-scene-layer', (e) => {
    const scene = typeof e.payload === 'string' ? e.payload : e.payload?.scene;
    if (scene) switchSceneMode(scene);
  });

  await listen<any>('change-ref-opacity', (e) => {
    const rawVal = typeof e.payload === 'number' ? e.payload : (e.payload?.opacity !== undefined ? e.payload.opacity * 100 : 100);
    const refContainer = document.getElementById('reference-canvas');
    if (refContainer) {
      refContainer.style.opacity = (rawVal > 1 ? rawVal / 100 : rawVal).toString();
    }
  });

  await listen<any>('toggle-auto-scene-control', (e) => {
    overlayState.isAutoSceneControl = typeof e.payload === 'boolean' ? e.payload : Boolean(e.payload?.enabled);
  });

  // 2. Background styling
  await listen<string>('change-overlay-bg', (e) => {
    document.body.style.backgroundColor = e.payload;
  });

  // 3. Mock simulation toggle
  await listen<any>('toggle-mock-simulation', (e) => {
    const isSim = typeof e.payload === 'boolean' ? e.payload : Boolean(e.payload?.enabled);
    overlayState.isSimulating = isSim;
    if (overlayState.isSimulating) {
      initMockData();
      if (overlayState.isAutoSceneControl) {
        switchSceneMode('competitive', true);
      }
    } else {
      if (overlayState.isAutoSceneControl) {
        switchSceneMode('not-connected', true);
      }
    }
  });

  // 4. Developer Dashboard Tuning
  await listen<any>('change-font-scale', (e) => {
    const size = typeof e.payload === 'number' ? e.payload : e.payload?.size;
    if (size !== undefined) {
      document.documentElement.style.setProperty('--replay-font-scale', `${size}vw`);
    }
  });

  await listen<{ width: number; height: number }>('change-bar-dimensions', (e) => {
    document.documentElement.style.setProperty('--bar-width', `${e.payload.width}vw`);
    document.documentElement.style.setProperty('--bar-height', `${e.payload.height}vw`);
  });

  await listen<any>('change-blink-freq', (e) => {
    const dur = typeof e.payload === 'number' ? e.payload : e.payload?.duration;
    if (dur !== undefined) {
      document.documentElement.style.setProperty('--boost-blink-duration', `${dur}s`);
    }
  });

  // 5. Replay Viewer Tuning
  await listen<any>('change-replay-transition-time', (e) => {
    const dur = typeof e.payload === 'number' ? e.payload : e.payload?.duration;
    if (dur !== undefined) {
      setReplayTransitionDuration(dur);
      document.documentElement.style.setProperty('--replay-transition-duration', `${dur}s`);
    }
  });

  await listen<void>('toggle-replay-footer', () => {
    const footer = document.getElementById('replayFooter') || document.querySelector('.rl-footer');
    if (footer) {
      if (footer.classList.contains('rl-footer-visible')) {
        willEndReplayView();
      } else {
        enterReplayView();
      }
    }
  });

  await listen<void>('simulate-replay-lifecycle', () => {
    enterReplayView();
    setTimeout(() => {
      willEndReplayView();
    }, 3500);
    setTimeout(() => {
      immediateEndReplayView();
    }, 4250);
  });

  // 6. Competitive Layout & 8-Point Dragger
  await listen<any>('toggle-layout-editing', async (e) => {
    const isEditing = typeof e.payload === 'boolean' ? e.payload : Boolean(e.payload?.enabled);
    overlayState.isLayoutEditing = isEditing;
    const dragger = getDragger();
    if (overlayState.isLayoutEditing) {
      document.body.classList.add('layout-editing');
      await setOverlayClickThrough(false);
    } else {
      document.body.classList.remove('layout-editing');
      dragger?.selectInstance(null);
      await setOverlayClickThrough(true);
    }
    renderCompetitiveScene(getCompetitiveInstances());
  });

  await listen<{ layout: ComponentInstance[] }>('update-competitive-layout', (e) => {
    setCompetitiveInstances(e.payload.layout);
    saveCompetitiveLayout(e.payload.layout);
    renderCompetitiveScene(e.payload.layout);
  });

  await listen<{ instanceId: string | null }>('select-competitive-component', (e) => {
    getDragger()?.selectInstance(e.payload.instanceId);
  });

  await listen<{ instanceId: string | null }>('hover-competitive-component', (e) => {
    const dragger = getDragger();
    if (dragger) {
      document.querySelectorAll('.comp-container').forEach((el) => {
        if (el.getAttribute('data-instance-id') === e.payload.instanceId) {
          el.classList.add('hovered');
        } else {
          el.classList.remove('hovered');
        }
      });
    }
  });

  await listen<{ settings: GlobalLayoutSettings }>('update-global-settings', (e) => {
    saveGlobalLayoutSettings(e.payload.settings);
    const globalSettings = loadGlobalLayoutSettings();
    updateOverlayGlobalSettings(globalSettings);
    const cachedInstances = getCompetitiveDomCache();
    cachedInstances.forEach((cached) => {
      applyStaticComponentStyles(cached, globalSettings);
    });
    applyAutoHideNonExistingPlayers(undefined, undefined, cachedInstances);
  });

  // 7. WebSocket IPC Controls
  await listen<{ host: string; port: string }>('ws-connect', (e) => {
    setWsConfig(e.payload.host, e.payload.port);
    connectWebSocket();
  });

  await listen<void>('ws-disconnect', () => {
    disconnectWebSocket();
  });

  await listen<{ events: string[] }>('set-active-capture-events', (e) => {
    setCaptureTargetEvents(e.payload.events);
  });

  await listen<{ events: string[] }>('request-packet-capture', (e) => {
    setCaptureRequested(true, e.payload?.events);
  });

  await listen<{ disabled: boolean }>('toggle-ws-auto-retry', (e) => {
    setAutoRetryDisabled(e.payload.disabled);
  });

  // 8. Timeline Console Logger IPC Controls
  await listen<{ enabled: boolean; events?: string[] }>('toggle-timeline-capture', (e) => {
    setTimelineCaptureState(e.payload.enabled, e.payload.events);
  });

  await listen<{ events: string[] }>('set-timeline-capture-events', (e) => {
    setTimelineCaptureEvents(e.payload.events);
  });

  // 9. Low-Frequency Telemetry Trigger IPC Controls
  await listen<{ events: string[] }>('set-low-freq-triggers', (e) => {
    setLowFreqTriggerEvents(e.payload.events);
  });

  await listen<void>('request-low-freq-sync', () => {
    requestLowFrequencySync();
  });

  // 10. Performance Benchmark IPC Trigger
  await listen<void>('start-performance-benchmark', () => {
    startBenchmark();
  });

  // 11. Ball Hit 2D Pitch Mapping & Calibration IPC Controls
  await listen<{ calibration: CalibrationSettings }>('pitch-calibration-update', (e) => {
    if (e.payload?.calibration) {
      updateCalibration(e.payload.calibration);
    }
  });

  await listen<{ controlPoints: ControlPoint[] }>('pitch-control-points-update', (e) => {
    if (e.payload?.controlPoints) {
      updateControlPoints(e.payload.controlPoints);
    }
  });

  await listen<{ mode: BallHitOperationMode }>('pitch-change-mode', (e) => {
    if (e.payload?.mode) {
      setOperationMode(e.payload.mode);
    }
  });

  await listen<{ recording: boolean }>('pitch-toggle-record', (e) => {
    if (e.payload !== undefined) {
      setRecordingState(Boolean(e.payload.recording));
    }
  });

  await listen<void>('pitch-clear-data', () => {
    clearHitHistory();
  });

  await listen<void>('pitch-clear-boosts', () => {
    clearBoostHistory();
  });

  await listen<void>('pitch-clear-all', () => {
    clearAllPitchData();
  });

  await listen<{ onlyLatest: boolean }>('pitch-toggle-latest-only', (e) => {
    if (e.payload?.onlyLatest !== undefined) {
      setOnlyLatestHit(Boolean(e.payload.onlyLatest));
    }
  });

  await listen<{ percent?: number; maxRadius?: number; preview?: boolean; previewSpeed?: number }>('pitch-speed-ring-update', (e) => {
    if (typeof e.payload?.percent === 'number') {
      setSpeedRingPercent(e.payload.percent);
    }
    if (e.payload?.preview !== undefined) {
      setPreviewSpeedRing(Boolean(e.payload.preview), e.payload.previewSpeed);
    } else if (typeof e.payload?.previewSpeed === 'number') {
      setPreviewSpeedKph(e.payload.previewSpeed);
    }
  });

  await listen<{ targetTeam: number }>('pitch-target-team-update', (e) => {
    if (typeof e.payload?.targetTeam === 'number') {
      setTargetTeam(e.payload.targetTeam);
    }
  });

  await listen<{ raw: string }>('pitch-import-data', (e) => {
    if (e.payload?.raw) {
      try {
        const parsed = JSON.parse(e.payload.raw);
        if (parsed.boosts || (Array.isArray(parsed) && parsed[0] && (parsed[0].boostType || parsed[0].BoostType))) {
          importBoostsFromJson(e.payload.raw);
        } else {
          importHitsFromJson(e.payload.raw);
        }
      } catch {
        importHitsFromJson(e.payload.raw);
      }
    }
  });

  // Window Resize & Initialization Events
  window.addEventListener('resize', () => {
    updateDimensions();
    markBallHitDirty();
  });

  // Initial Sync to Configurator
  notifyWsStatus();
  updateDimensions();
}
