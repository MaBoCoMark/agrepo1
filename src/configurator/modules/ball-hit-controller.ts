import { emitTo, listen } from '@tauri-apps/api/event';
import {
  ControlPoint,
  CalibrationSettings,
  DEFAULT_CONTROL_POINTS,
  DEFAULT_CALIBRATION,
  generatePitchConfigJson,
  loadSavedCalibration,
  saveCalibrationToStorage,
  loadSavedControlPoints,
  saveControlPointsToStorage
} from '../../overlay/core/pitch-geometry';

/**
 * ============================================================================
 * 🎮 Ball Hit Inspector & 2D Pitch Mapping Configurator Controller
 * ============================================================================
 */

export function initBallHitController(): void {
  let calibration: CalibrationSettings = loadSavedCalibration();
  let controlPoints: ControlPoint[] = loadSavedControlPoints();
  let currentMode: 'mapping' | 'calibration' = 'mapping';
  let isRecording = true;
  let onlyLatestHit = true;
  let speedRingPercent = 20;
  let isPreviewActive = false;
  let previewSpeed = 110;

  // DOM Elements
  const modeMappingRadio = document.getElementById('bh-cfg-mode-mapping') as HTMLInputElement | null;
  const modeCalibRadio = document.getElementById('bh-cfg-mode-calib') as HTMLInputElement | null;

  const btnToggleRec = document.getElementById('bh-cfg-btn-toggle-rec');
  const btnClearHits = document.getElementById('bh-cfg-btn-clear-hits');
  const btnClearBoosts = document.getElementById('bh-cfg-btn-clear-boosts');
  const btnExportJson = document.getElementById('bh-cfg-btn-export-json');
  const btnExportBoostJson = document.getElementById('bh-cfg-btn-export-boost-json');
  const btnImportJson = document.getElementById('bh-cfg-btn-import-json');
  const btnResetCalib = document.getElementById('bh-cfg-btn-reset-calib');

  const offsetXSlider = document.getElementById('bh-cfg-offset-x-slider') as HTMLInputElement | null;
  const offsetXVal = document.getElementById('bh-cfg-offset-x-val');
  const offsetYSlider = document.getElementById('bh-cfg-offset-y-slider') as HTMLInputElement | null;
  const offsetYVal = document.getElementById('bh-cfg-offset-y-val');

  const scaleXSlider = document.getElementById('bh-cfg-scale-x-slider') as HTMLInputElement | null;
  const scaleXVal = document.getElementById('bh-cfg-scale-x-val');
  const scaleYSlider = document.getElementById('bh-cfg-scale-y-slider') as HTMLInputElement | null;
  const scaleYVal = document.getElementById('bh-cfg-scale-y-val');

  const invertXCheck = document.getElementById('bh-cfg-invert-x-check') as HTMLInputElement | null;
  const invertYCheck = document.getElementById('bh-cfg-invert-y-check') as HTMLInputElement | null;

  const onlyLatestCheck = document.getElementById('bh-cfg-only-latest-check') as HTMLInputElement | null;
  const ringPercentSlider = document.getElementById('bh-cfg-ring-percent-slider') as HTMLInputElement | null;
  const ringPercentVal = document.getElementById('bh-cfg-ring-percent-val');
  const previewCheck = document.getElementById('bh-cfg-preview-check') as HTMLInputElement | null;
  const previewSpeedSlider = document.getElementById('bh-cfg-preview-speed-slider') as HTMLInputElement | null;
  const previewSpeedVal = document.getElementById('bh-cfg-preview-speed-val');

  const pointsTableContainer = document.getElementById('bh-cfg-points-table');

  function syncCalibrationToOverlay() {
    saveCalibrationToStorage(calibration);
    emitTo('overlay', 'pitch-calibration-update', { calibration });
  }

  function syncControlPointsToOverlay() {
    saveControlPointsToStorage(controlPoints);
    emitTo('overlay', 'pitch-control-points-update', { controlPoints });
  }

  function renderPointsTable() {
    if (!pointsTableContainer) return;
    pointsTableContainer.innerHTML = controlPoints.map((cp) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 6px; background: var(--primer-canvas-subtle); border-radius: 4px; font-size: 10px; font-family: monospace;">
        <span style="color: var(--primer-accent-fg); font-weight: bold; width: 30px;">${cp.id}</span>
        <span style="color: var(--primer-fg-muted); flex: 1;">${cp.name}</span>
        <span style="color: var(--primer-fg-default); font-variant-numeric: tabular-nums;">X: ${cp.x.toFixed(1)}</span>
        <span style="color: var(--primer-fg-default); margin-left: 8px; font-variant-numeric: tabular-nums;">Y: ${cp.y.toFixed(1)}</span>
      </div>
    `).join('');
  }

  function updateUI() {
    if (modeMappingRadio) modeMappingRadio.checked = currentMode === 'mapping';
    if (modeCalibRadio) modeCalibRadio.checked = currentMode === 'calibration';

    if (btnToggleRec) {
      btnToggleRec.textContent = isRecording ? '⏸ Pause Recording' : '▶ Resume Recording';
      btnToggleRec.className = isRecording ? 'btn btn-sm btn-secondary' : 'btn btn-sm btn-success';
    }

    if (offsetXSlider) offsetXSlider.value = calibration.offsetX.toString();
    if (offsetXVal) offsetXVal.textContent = calibration.offsetX.toFixed(0);

    if (offsetYSlider) offsetYSlider.value = calibration.offsetY.toString();
    if (offsetYVal) offsetYVal.textContent = calibration.offsetY.toFixed(0);

    if (scaleXSlider) scaleXSlider.value = Math.round(calibration.scaleX * 100).toString();
    if (scaleXVal) scaleXVal.textContent = `${calibration.scaleX.toFixed(2)}x`;

    if (scaleYSlider) scaleYSlider.value = Math.round(calibration.scaleY * 100).toString();
    if (scaleYVal) scaleYVal.textContent = `${calibration.scaleY.toFixed(2)}x`;

    if (invertXCheck) invertXCheck.checked = calibration.invertX;
    if (invertYCheck) invertYCheck.checked = calibration.invertY;

    if (onlyLatestCheck) onlyLatestCheck.checked = onlyLatestHit;

    if (ringPercentSlider) ringPercentSlider.value = speedRingPercent.toString();
    if (ringPercentVal) ringPercentVal.textContent = `${speedRingPercent}%`;

    if (previewCheck) previewCheck.checked = isPreviewActive;
    if (previewSpeedSlider) previewSpeedSlider.value = previewSpeed.toString();
    if (previewSpeedVal) previewSpeedVal.textContent = `${previewSpeed} KPH`;

    renderPointsTable();
  }

  // Mode radio events
  modeMappingRadio?.addEventListener('change', () => {
    if (modeMappingRadio.checked) {
      currentMode = 'mapping';
      emitTo('overlay', 'pitch-change-mode', { mode: 'mapping' });
    }
  });

  modeCalibRadio?.addEventListener('change', () => {
    if (modeCalibRadio.checked) {
      currentMode = 'calibration';
      emitTo('overlay', 'pitch-change-mode', { mode: 'calibration' });
    }
  });

  // Action Buttons
  btnToggleRec?.addEventListener('click', () => {
    isRecording = !isRecording;
    emitTo('overlay', 'pitch-toggle-record', { recording: isRecording });
    updateUI();
  });

  btnClearHits?.addEventListener('click', () => {
    emitTo('overlay', 'pitch-clear-data');
  });

  btnClearBoosts?.addEventListener('click', () => {
    emitTo('overlay', 'pitch-clear-boosts');
  });

  btnExportJson?.addEventListener('click', () => {
    const config = generatePitchConfigJson(controlPoints, calibration);
    const jsonStr = JSON.stringify(config, null, 2);
    void navigator.clipboard.writeText(jsonStr);
    alert('✅ 16 Control Points Configuration JSON copied to clipboard!');
  });

  btnExportBoostJson?.addEventListener('click', () => {
    emitTo('overlay', 'pitch-export-boosts');
  });

  btnImportJson?.addEventListener('click', () => {
    const raw = prompt('Paste Pitch Configuration JSON (16 Control Points), Hit Packets, or Boost Data:');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.controlPoints && Array.isArray(parsed.controlPoints) && parsed.controlPoints.length === 16) {
          controlPoints = parsed.controlPoints;
          if (parsed.calibration) {
            calibration = { ...calibration, ...parsed.calibration };
          }
          syncControlPointsToOverlay();
          syncCalibrationToOverlay();
          updateUI();
          alert('✅ 16 Control Points successfully imported and synced!');
        } else {
          emitTo('overlay', 'pitch-import-data', { raw });
          alert('✅ Telemetry data sent to overlay for map plotting!');
        }
      } catch (err) {
        alert('❌ Invalid JSON data.');
      }
    }
  });

  btnResetCalib?.addEventListener('click', () => {
    calibration = { ...DEFAULT_CALIBRATION };
    controlPoints = JSON.parse(JSON.stringify(DEFAULT_CONTROL_POINTS));
    syncCalibrationToOverlay();
    syncControlPointsToOverlay();
    updateUI();
  });

  // Sliders
  offsetXSlider?.addEventListener('input', () => {
    calibration.offsetX = parseFloat(offsetXSlider.value);
    if (offsetXVal) offsetXVal.textContent = calibration.offsetX.toFixed(0);
    syncCalibrationToOverlay();
  });

  offsetYSlider?.addEventListener('input', () => {
    calibration.offsetY = parseFloat(offsetYSlider.value);
    if (offsetYVal) offsetYVal.textContent = calibration.offsetY.toFixed(0);
    syncCalibrationToOverlay();
  });

  scaleXSlider?.addEventListener('input', () => {
    calibration.scaleX = parseInt(scaleXSlider.value, 10) / 100;
    if (scaleXVal) scaleXVal.textContent = `${calibration.scaleX.toFixed(2)}x`;
    syncCalibrationToOverlay();
  });

  scaleYSlider?.addEventListener('input', () => {
    calibration.scaleY = parseInt(scaleYSlider.value, 10) / 100;
    if (scaleYVal) scaleYVal.textContent = `${calibration.scaleY.toFixed(2)}x`;
    syncCalibrationToOverlay();
  });

  invertXCheck?.addEventListener('change', () => {
    calibration.invertX = invertXCheck.checked;
    syncCalibrationToOverlay();
  });

  invertYCheck?.addEventListener('change', () => {
    calibration.invertY = invertYCheck.checked;
    syncCalibrationToOverlay();
  });

  // Hit Tracking & Speed Ring Percentage Tuning
  onlyLatestCheck?.addEventListener('change', () => {
    onlyLatestHit = onlyLatestCheck.checked;
    emitTo('overlay', 'pitch-toggle-latest-only', { onlyLatest: onlyLatestHit });
  });

  ringPercentSlider?.addEventListener('input', () => {
    speedRingPercent = parseInt(ringPercentSlider.value, 10);
    if (ringPercentVal) ringPercentVal.textContent = `${speedRingPercent}%`;
    emitTo('overlay', 'pitch-speed-ring-update', { percent: speedRingPercent });
  });

  previewCheck?.addEventListener('change', () => {
    isPreviewActive = previewCheck.checked;
    emitTo('overlay', 'pitch-speed-ring-update', { preview: isPreviewActive, previewSpeed });
  });

  previewSpeedSlider?.addEventListener('input', () => {
    previewSpeed = parseInt(previewSpeedSlider.value, 10);
    if (previewSpeedVal) previewSpeedVal.textContent = `${previewSpeed} KPH`;
    if (!isPreviewActive && previewCheck) {
      isPreviewActive = true;
      previewCheck.checked = true;
    }
    emitTo('overlay', 'pitch-speed-ring-update', { preview: isPreviewActive, previewSpeed });
  });

  // Listen for updates from overlay
  void listen<{ points: ControlPoint[]; calibration?: CalibrationSettings }>('pitch-data-updated-from-overlay', (event) => {
    if (event.payload.points) {
      controlPoints = event.payload.points;
    }
    if (event.payload.calibration) {
      calibration = event.payload.calibration;
    }
    updateUI();
  });

  updateUI();
}
