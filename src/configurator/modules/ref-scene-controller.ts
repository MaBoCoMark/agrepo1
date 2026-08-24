import { emitTo, listen } from '@tauri-apps/api/event';
import { getMergedManifest } from '../../overlay/core/config-loader';
import { setOverlayClickThrough } from '../../overlay/core/telemetry-state';
import { loadGlobalLayoutSettings, saveGlobalLayoutSettings } from '../../overlay/core/layout-store';

/**
 * ============================================================================
 * 🎛️ Reference Canvas & Scene Controller
 * ============================================================================
 */

export function initRefSceneController(): void {
  const manifest = getMergedManifest();
  let activeScene = localStorage.getItem('saved_scene_mode') || 'developer-dashboard';
  let isAutoSceneControlEnabled = true;

  const autoSceneCheck = document.getElementById('auto-scene-control-check') as HTMLInputElement | null;
  const autoHideCheck = document.getElementById('auto-hide-non-existing-check') as HTMLInputElement | null;
  const refContainer = document.getElementById('ref-container');
  const sceneContainer = document.getElementById('scene-container');
  const compSection = document.getElementById('competitive-designer-section');
  const compDivider = document.getElementById('comp-divider');
  const devTuningSection = document.getElementById('dev-dashboard-tuning-section');
  const replayTuningSection = document.getElementById('replay-tuning-section');
  const ballHitTuningSection = document.getElementById('ball-hit-tuning-section');
  const ballHitSvgTuningSection = document.getElementById('ball-hit-svg-tuning-section');

  const savedRef = 'empty';

  function updateSceneVisibility(sceneId: string) {
    activeScene = sceneId;
    localStorage.setItem('saved_scene_mode', sceneId);

    if (compSection) compSection.style.display = sceneId === 'competitive' ? 'block' : 'none';
    if (compDivider) compDivider.style.display = sceneId === 'competitive' ? 'block' : 'none';
    if (devTuningSection) devTuningSection.style.display = (sceneId === 'developer-dashboard' || sceneId === 'live-replay') ? 'block' : 'none';
    if (replayTuningSection) replayTuningSection.style.display = sceneId === 'replay-viewer' ? 'block' : 'none';
    if (ballHitTuningSection) ballHitTuningSection.style.display = sceneId === 'ball-hit' ? 'block' : 'none';
    if (ballHitSvgTuningSection) ballHitSvgTuningSection.style.display = sceneId === 'ball-hit-svg' ? 'block' : 'none';

    if (sceneId !== 'competitive') {
      const editCheck = document.getElementById('layout-editing-check') as HTMLInputElement | null;
      if (editCheck && editCheck.checked) {
        editCheck.checked = false;
        emitTo('overlay', 'toggle-layout-editing', false);
        emitTo('overlay', 'toggle-layout-editing', { enabled: false });
        void setOverlayClickThrough(true);
        emitTo('overlay', 'select-competitive-component', { instanceId: null });
      }
    }
  }

  function updateSceneRadiosDisabledState(autoControl: boolean) {
    if (!sceneContainer) return;
    const inputs = sceneContainer.querySelectorAll<HTMLInputElement>('input[type=\"radio\"]');
    inputs.forEach((input) => {
      input.disabled = autoControl;
      const label = input.parentElement;
      if (label) {
        label.style.opacity = autoControl ? '0.5' : '1';
        label.style.cursor = autoControl ? 'not-allowed' : 'pointer';
      }
    });
  }

  function updateActiveSceneRadio(sceneId: string) {
    if (!sceneContainer) return;
    const targetInput = sceneContainer.querySelector<HTMLInputElement>(`input[value=\"${sceneId}\"]`);
    if (targetInput) {
      targetInput.checked = true;
    }
  }

  // Automatic Scene Control Checkbox
  if (autoSceneCheck) {
    isAutoSceneControlEnabled = autoSceneCheck.checked;
    autoSceneCheck.addEventListener('change', () => {
      isAutoSceneControlEnabled = autoSceneCheck.checked;
      updateSceneRadiosDisabledState(isAutoSceneControlEnabled);
      emitTo('overlay', 'toggle-auto-scene-control', isAutoSceneControlEnabled);
      emitTo('overlay', 'toggle-auto-scene-control', { enabled: isAutoSceneControlEnabled });
    });
  }

  // Auto Hide Non-Existing Checkbox
  if (autoHideCheck) {
    const currentGlobal = loadGlobalLayoutSettings();
    autoHideCheck.checked = currentGlobal.autoHideNonExistingPlayers !== false;
    autoHideCheck.addEventListener('change', () => {
      const globalSettings = loadGlobalLayoutSettings();
      globalSettings.autoHideNonExistingPlayers = autoHideCheck.checked;
      saveGlobalLayoutSettings(globalSettings);
      emitTo('overlay', 'update-global-settings', { settings: globalSettings });
    });
  }

  // 1. References Group
  if (refContainer) {
    manifest.references.forEach((item: any) => {
      const label = document.createElement('label');
      label.style.display = 'block';
      label.style.cursor = 'pointer';
      label.style.margin = '3px 0';
      label.innerHTML = `<input type=\"radio\" name=\"ref-group\" value=\"${item.id}\" ${item.id === savedRef ? 'checked' : ''} style=\"margin-right: 6px;\"> ${item.name}`;
      refContainer.appendChild(label);
      label.querySelector('input')?.addEventListener('change', () => {
        emitTo('overlay', 'change-ref-layer', item.id);
        emitTo('overlay', 'change-ref-layer', { mode: item.id });
      });
    });
  }

  // 2. Scenes Group
  if (sceneContainer) {
    manifest.scenes.forEach((item: any) => {
      const label = document.createElement('label');
      label.style.display = 'block';
      label.style.cursor = 'pointer';
      label.style.margin = '3px 0';
      label.innerHTML = `<input type=\"radio\" name=\"scene-group\" value=\"${item.id}\" ${item.id === activeScene ? 'checked' : ''} style=\"margin-right: 6px;\"> ${item.name}`;
      sceneContainer.appendChild(label);
      label.querySelector('input')?.addEventListener('change', () => {
        updateSceneVisibility(item.id);
        emitTo('overlay', 'change-scene-layer', item.id);
        emitTo('overlay', 'change-scene-layer', { scene: item.id });
      });
    });
  }

  updateSceneVisibility(activeScene);
  updateSceneRadiosDisabledState(isAutoSceneControlEnabled);

  // Listen for scene auto switch from overlay
  void listen<{ scene: string }>('scene-auto-switched', (event) => {
    const sId = event.payload.scene;
    updateActiveSceneRadio(sId);
    updateSceneVisibility(sId);
  });

  // 3. Opacity scroll
  const opacityZone = document.getElementById('opacity-zone');
  const opacityVal = document.getElementById('opacity-val');
  let opacity = 100;
  if (opacityZone && opacityVal) {
    opacityZone.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) opacity = Math.min(100, opacity + 5);
      else opacity = Math.max(0, opacity - 5);
      opacityVal.textContent = opacity.toString();
      emitTo('overlay', 'change-ref-opacity', opacity);
      emitTo('overlay', 'change-ref-opacity', { opacity: opacity / 100 });
    });
  }

  // 4. Developer Dashboard Font Scale
  const fontZone = document.getElementById('font-size-zone');
  const fontVal = document.getElementById('font-size-val');
  let currentFontScale = 2.0;
  if (fontVal) fontVal.textContent = currentFontScale.toFixed(1);

  if (fontZone && fontVal) {
    fontZone.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        currentFontScale = parseFloat((currentFontScale + 0.1).toFixed(1));
      } else {
        currentFontScale = Math.max(0.5, parseFloat((currentFontScale - 0.1).toFixed(1)));
      }
      fontVal.textContent = currentFontScale.toFixed(1);
      emitTo('overlay', 'change-font-scale', currentFontScale);
      emitTo('overlay', 'change-font-scale', { size: currentFontScale });
    });
  }

  // 5. Developer Dashboard Bar Dimensions
  const barWidthZone = document.getElementById('bar-width-zone');
  const barWidthVal = document.getElementById('bar-width-val');
  let currentBarWidth = 12.0;
  let currentBarHeight = 1.0;
  if (barWidthVal) barWidthVal.textContent = currentBarWidth.toFixed(1);

  if (barWidthZone && barWidthVal) {
    barWidthZone.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) currentBarWidth = parseFloat((currentBarWidth + 0.1).toFixed(1));
      else currentBarWidth = Math.max(1.0, parseFloat((currentBarWidth - 0.1).toFixed(1)));
      barWidthVal.textContent = currentBarWidth.toFixed(1);
      emitTo('overlay', 'change-bar-dimensions', { width: currentBarWidth, height: currentBarHeight });
    });
  }

  const barHeightZone = document.getElementById('bar-height-zone');
  const barHeightVal = document.getElementById('bar-height-val');
  if (barHeightVal) barHeightVal.textContent = currentBarHeight.toFixed(1);

  if (barHeightZone && barHeightVal) {
    barHeightZone.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) currentBarHeight = parseFloat((currentBarHeight + 0.1).toFixed(1));
      else currentBarHeight = Math.max(0.1, parseFloat((currentBarHeight - 0.1).toFixed(1)));
      barHeightVal.textContent = currentBarHeight.toFixed(1);
      emitTo('overlay', 'change-bar-dimensions', { width: currentBarWidth, height: currentBarHeight });
    });
  }

  // 6. Blink Duration
  const blinkZone = document.getElementById('blink-freq-zone');
  const blinkVal = document.getElementById('blink-freq-val');
  let currentBlinkDuration = 0.5;
  if (blinkVal) blinkVal.textContent = currentBlinkDuration.toFixed(2);

  if (blinkZone && blinkVal) {
    blinkZone.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        currentBlinkDuration = Math.min(3.0, parseFloat((currentBlinkDuration + 0.05).toFixed(2)));
      } else {
        currentBlinkDuration = Math.max(0.1, parseFloat((currentBlinkDuration - 0.05).toFixed(2)));
      }
      blinkVal.textContent = currentBlinkDuration.toFixed(2);
      emitTo('overlay', 'change-blink-freq', currentBlinkDuration);
      emitTo('overlay', 'change-blink-freq', { duration: currentBlinkDuration });
    });
  }

  // 7. Replay Viewer Tuning & Test Controls
  const replayTransZone = document.getElementById('replay-transition-zone');
  const replayTransVal = document.getElementById('replay-transition-val');
  let currentReplayDuration = 0.75;
  if (replayTransVal) replayTransVal.textContent = currentReplayDuration.toFixed(2);

  if (replayTransZone && replayTransVal) {
    replayTransZone.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        currentReplayDuration = Math.min(3.0, parseFloat((currentReplayDuration + 0.05).toFixed(2)));
      } else {
        currentReplayDuration = Math.max(0.1, parseFloat((currentReplayDuration - 0.05).toFixed(2)));
      }
      replayTransVal.textContent = currentReplayDuration.toFixed(2);
      emitTo('overlay', 'change-replay-transition-time', currentReplayDuration);
    });
  }

  const btnToggleReplay = document.getElementById('btn-toggle-replay-footer');
  btnToggleReplay?.addEventListener('click', () => {
    emitTo('overlay', 'toggle-replay-footer');
  });

  const btnSimReplay = document.getElementById('btn-test-replay-lifecycle');
  btnSimReplay?.addEventListener('click', () => {
    emitTo('overlay', 'simulate-replay-lifecycle');
  });
}
