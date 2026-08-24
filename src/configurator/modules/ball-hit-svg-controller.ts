import { emitTo, listen } from '@tauri-apps/api/event';
import {
  BallHitSvgConfig,
  DEFAULT_BALL_HIT_SVG_CONFIG,
  loadSavedBallHitSvgConfig,
  saveBallHitSvgConfig
} from '../../overlay/core/ball-hit-svg-tracker';

/**
 * ============================================================================
 * 🎛️ Ball Hit SVG & Pitch MiniMap Configurator Controller
 * ============================================================================
 */

export function initBallHitSvgController(): void {
  let config: BallHitSvgConfig = loadSavedBallHitSvgConfig();
  let simTargetTeam = 0; // 0 = Blue, 1 = Orange

  // Pitch Boundary DOM Elements
  const borderStrokeSlider = document.getElementById('bh-svg-border-stroke-slider') as HTMLInputElement | null;
  const borderStrokeVal = document.getElementById('bh-svg-border-stroke-val');
  const borderColorPicker = document.getElementById('bh-svg-border-color-picker') as HTMLInputElement | null;
  const borderColorHex = document.getElementById('bh-svg-border-color-hex') as HTMLInputElement | null;
  const borderOpacitySlider = document.getElementById('bh-svg-border-opacity-slider') as HTMLInputElement | null;
  const borderOpacityVal = document.getElementById('bh-svg-border-opacity-val');

  const bgFillColorPicker = document.getElementById('bh-svg-bg-color-picker') as HTMLInputElement | null;
  const bgFillColorHex = document.getElementById('bh-svg-bg-color-hex') as HTMLInputElement | null;
  const bgFillOpacitySlider = document.getElementById('bh-svg-bg-opacity-slider') as HTMLInputElement | null;
  const bgFillOpacityVal = document.getElementById('bh-svg-bg-opacity-val');

  const pitchLineColorPicker = document.getElementById('bh-svg-line-color-picker') as HTMLInputElement | null;
  const pitchLineColorHex = document.getElementById('bh-svg-line-color-hex') as HTMLInputElement | null;
  const pitchLineOpacitySlider = document.getElementById('bh-svg-line-opacity-slider') as HTMLInputElement | null;
  const pitchLineOpacityVal = document.getElementById('bh-svg-line-opacity-val');

  // Boost DOM Elements
  const padRadiusSlider = document.getElementById('bh-svg-pad-radius-slider') as HTMLInputElement | null;
  const padRadiusVal = document.getElementById('bh-svg-pad-radius-val');
  const padColorPicker = document.getElementById('bh-svg-pad-color-picker') as HTMLInputElement | null;
  const padColorHex = document.getElementById('bh-svg-pad-color-hex') as HTMLInputElement | null;
  const padOpacitySlider = document.getElementById('bh-svg-pad-opacity-slider') as HTMLInputElement | null;
  const padOpacityVal = document.getElementById('bh-svg-pad-opacity-val');

  const pillScaleSlider = document.getElementById('bh-svg-pill-scale-slider') as HTMLInputElement | null;
  const pillScaleVal = document.getElementById('bh-svg-pill-scale-val');
  const pillColorPicker = document.getElementById('bh-svg-pill-color-picker') as HTMLInputElement | null;
  const pillColorHex = document.getElementById('bh-svg-pill-color-hex') as HTMLInputElement | null;
  const pillOpacitySlider = document.getElementById('bh-svg-pill-opacity-slider') as HTMLInputElement | null;
  const pillOpacityVal = document.getElementById('bh-svg-pill-opacity-val');

  // Ball Hit Indicator Center Dot DOM Elements
  const dotRadiusSlider = document.getElementById('bh-svg-dot-radius-slider') as HTMLInputElement | null;
  const dotRadiusVal = document.getElementById('bh-svg-dot-radius-val');

  const myDotColorPicker = document.getElementById('bh-svg-my-dot-color-picker') as HTMLInputElement | null;
  const myDotColorHex = document.getElementById('bh-svg-my-dot-color-hex') as HTMLInputElement | null;
  const myDotOpacitySlider = document.getElementById('bh-svg-my-dot-opacity-slider') as HTMLInputElement | null;
  const myDotOpacityVal = document.getElementById('bh-svg-my-dot-opacity-val');

  const oppDotColorPicker = document.getElementById('bh-svg-opp-dot-color-picker') as HTMLInputElement | null;
  const oppDotColorHex = document.getElementById('bh-svg-opp-dot-color-hex') as HTMLInputElement | null;
  const oppDotOpacitySlider = document.getElementById('bh-svg-opp-dot-opacity-slider') as HTMLInputElement | null;
  const oppDotOpacityVal = document.getElementById('bh-svg-opp-dot-opacity-val');

  // Outer Speed Ring DOM Elements
  const ringMaxPercentSlider = document.getElementById('bh-svg-ring-max-percent-slider') as HTMLInputElement | null;
  const ringMaxPercentVal = document.getElementById('bh-svg-ring-max-percent-val');

  const ringBorderColorPicker = document.getElementById('bh-svg-ring-border-color-picker') as HTMLInputElement | null;
  const ringBorderColorHex = document.getElementById('bh-svg-ring-border-color-hex') as HTMLInputElement | null;
  const ringBorderWidthSlider = document.getElementById('bh-svg-ring-border-width-slider') as HTMLInputElement | null;
  const ringBorderWidthVal = document.getElementById('bh-svg-ring-border-width-val');
  const ringBorderOpacitySlider = document.getElementById('bh-svg-ring-border-opacity-slider') as HTMLInputElement | null;
  const ringBorderOpacityVal = document.getElementById('bh-svg-ring-border-opacity-val');

  const ringFillColorPicker = document.getElementById('bh-svg-ring-fill-color-picker') as HTMLInputElement | null;
  const ringFillColorHex = document.getElementById('bh-svg-ring-fill-color-hex') as HTMLInputElement | null;
  const ringFillOpacitySlider = document.getElementById('bh-svg-ring-fill-opacity-slider') as HTMLInputElement | null;
  const ringFillOpacityVal = document.getElementById('bh-svg-ring-fill-opacity-val');

  const ringPreviewCheck = document.getElementById('bh-svg-ring-preview-check') as HTMLInputElement | null;
  const ringPreviewSpeedSlider = document.getElementById('bh-svg-ring-preview-speed-slider') as HTMLInputElement | null;
  const ringPreviewSpeedVal = document.getElementById('bh-svg-ring-preview-speed-val');

  // Animation DOM Elements
  const animHoldSlider = document.getElementById('bh-svg-anim-hold-slider') as HTMLInputElement | null;
  const animHoldVal = document.getElementById('bh-svg-anim-hold-val');
  const animFadeSlider = document.getElementById('bh-svg-anim-fade-slider') as HTMLInputElement | null;
  const animFadeVal = document.getElementById('bh-svg-anim-fade-val');
  const animTotalVal = document.getElementById('bh-svg-anim-total-val');

  const animEasingSelect = document.getElementById('bh-svg-anim-easing-select') as HTMLSelectElement | null;
  const animCustomEasingWrap = document.getElementById('bh-svg-custom-easing-wrap');
  const animCustomEasingInput = document.getElementById('bh-svg-anim-custom-easing') as HTMLInputElement | null;

  // Action Buttons
  const btnSimMyHit = document.getElementById('bh-svg-btn-sim-my-hit');
  const btnSimOppHit = document.getElementById('bh-svg-btn-sim-opp-hit');
  const btnToggle180Flip = document.getElementById('bh-svg-btn-toggle-180');
  const flipTeamVal = document.getElementById('bh-svg-flip-team-val');

  // Mini Map Layout & Ratio
  const containerWidthSlider = document.getElementById('bh-svg-width-slider') as HTMLInputElement | null;
  const containerWidthVal = document.getElementById('bh-svg-width-val');
  const containerHeightVal = document.getElementById('bh-svg-height-val');
  const lockAspectCheck = document.getElementById('bh-svg-lock-aspect-check') as HTMLInputElement | null;
  const btnResetPos = document.getElementById('bh-svg-btn-reset-pos');
  const btnResetAll = document.getElementById('bh-svg-btn-reset-all');

  function syncConfigToOverlay() {
    saveBallHitSvgConfig(config);
    emitTo('overlay', 'ball-hit-svg-config-update', { config });
  }

  function updateUI() {
    // Pitch Boundary
    if (borderStrokeSlider) borderStrokeSlider.value = config.borderStrokeWidth.toString();
    if (borderStrokeVal) borderStrokeVal.textContent = config.borderStrokeWidth.toString();
    if (borderColorPicker) borderColorPicker.value = config.borderColor;
    if (borderColorHex) borderColorHex.value = config.borderColor;
    if (borderOpacitySlider) borderOpacitySlider.value = Math.round(config.borderOpacity * 100).toString();
    if (borderOpacityVal) borderOpacityVal.textContent = `${Math.round(config.borderOpacity * 100)}%`;

    if (bgFillColorPicker) bgFillColorPicker.value = config.bgFillColor;
    if (bgFillColorHex) bgFillColorHex.value = config.bgFillColor;
    if (bgFillOpacitySlider) bgFillOpacitySlider.value = Math.round(config.bgFillOpacity * 100).toString();
    if (bgFillOpacityVal) bgFillOpacityVal.textContent = `${Math.round(config.bgFillOpacity * 100)}%`;

    if (pitchLineColorPicker) pitchLineColorPicker.value = config.pitchLineColor;
    if (pitchLineColorHex) pitchLineColorHex.value = config.pitchLineColor;
    if (pitchLineOpacitySlider) pitchLineOpacitySlider.value = Math.round(config.pitchLineOpacity * 100).toString();
    if (pitchLineOpacityVal) pitchLineOpacityVal.textContent = `${Math.round(config.pitchLineOpacity * 100)}%`;

    // Boost Resources
    if (padRadiusSlider) padRadiusSlider.value = config.padRadius.toString();
    if (padRadiusVal) padRadiusVal.textContent = `${config.padRadius} uu`;
    if (padColorPicker) padColorPicker.value = config.padColor;
    if (padColorHex) padColorHex.value = config.padColor;
    if (padOpacitySlider) padOpacitySlider.value = Math.round(config.padOpacity * 100).toString();
    if (padOpacityVal) padOpacityVal.textContent = `${Math.round(config.padOpacity * 100)}%`;

    if (pillScaleSlider) pillScaleSlider.value = Math.round(config.pillRadiusScale * 100).toString();
    if (pillScaleVal) pillScaleVal.textContent = `${Math.round(config.pillRadiusScale * 100)}% (${config.pillRadiusScale.toFixed(1)}x)`;
    if (pillColorPicker) pillColorPicker.value = config.pillColor;
    if (pillColorHex) pillColorHex.value = config.pillColor;
    if (pillOpacitySlider) pillOpacitySlider.value = Math.round(config.pillOpacity * 100).toString();
    if (pillOpacityVal) pillOpacityVal.textContent = `${Math.round(config.pillOpacity * 100)}%`;

    // Dot
    if (dotRadiusSlider) dotRadiusSlider.value = config.dotRadius.toString();
    if (dotRadiusVal) dotRadiusVal.textContent = `${config.dotRadius} px`;

    if (myDotColorPicker) myDotColorPicker.value = config.myTeamDotColor;
    if (myDotColorHex) myDotColorHex.value = config.myTeamDotColor;
    if (myDotOpacitySlider) myDotOpacitySlider.value = Math.round(config.myTeamDotOpacity * 100).toString();
    if (myDotOpacityVal) myDotOpacityVal.textContent = `${Math.round(config.myTeamDotOpacity * 100)}%`;

    if (oppDotColorPicker) oppDotColorPicker.value = config.oppTeamDotColor;
    if (oppDotColorHex) oppDotColorHex.value = config.oppTeamDotColor;
    if (oppDotOpacitySlider) oppDotOpacitySlider.value = Math.round(config.oppTeamDotOpacity * 100).toString();
    if (oppDotOpacityVal) oppDotOpacityVal.textContent = `${Math.round(config.oppTeamDotOpacity * 100)}%`;

    // Outer Ring
    if (ringMaxPercentSlider) ringMaxPercentSlider.value = config.ringMaxPercent.toString();
    if (ringMaxPercentVal) ringMaxPercentVal.textContent = `${config.ringMaxPercent}%`;

    if (ringBorderColorPicker) ringBorderColorPicker.value = config.ringBorderColor;
    if (ringBorderColorHex) ringBorderColorHex.value = config.ringBorderColor;
    if (ringBorderWidthSlider) ringBorderWidthSlider.value = config.ringBorderWidth.toString();
    if (ringBorderWidthVal) ringBorderWidthVal.textContent = `${config.ringBorderWidth} px`;
    if (ringBorderOpacitySlider) ringBorderOpacitySlider.value = Math.round(config.ringBorderOpacity * 100).toString();
    if (ringBorderOpacityVal) ringBorderOpacityVal.textContent = `${Math.round(config.ringBorderOpacity * 100)}%`;

    if (ringFillColorPicker) ringFillColorPicker.value = config.ringFillColor;
    if (ringFillColorHex) ringFillColorHex.value = config.ringFillColor;
    if (ringFillOpacitySlider) ringFillOpacitySlider.value = Math.round(config.ringFillOpacity * 100).toString();
    if (ringFillOpacityVal) ringFillOpacityVal.textContent = `${Math.round(config.ringFillOpacity * 100)}%`;

    if (ringPreviewCheck) ringPreviewCheck.checked = config.ringPreviewActive;
    if (ringPreviewSpeedSlider) ringPreviewSpeedSlider.value = config.ringPreviewSpeed.toString();
    if (ringPreviewSpeedVal) ringPreviewSpeedVal.textContent = `${config.ringPreviewSpeed} KPH`;

    // Animation
    if (animHoldSlider) animHoldSlider.value = config.animHoldDuration.toString();
    if (animHoldVal) animHoldVal.textContent = `${config.animHoldDuration.toFixed(2)}s`;
    if (animFadeSlider) animFadeSlider.value = config.animFadeDuration.toString();
    if (animFadeVal) animFadeVal.textContent = `${config.animFadeDuration.toFixed(2)}s`;
    if (animTotalVal) animTotalVal.textContent = `${(config.animHoldDuration + config.animFadeDuration).toFixed(2)}s`;

    if (animEasingSelect) animEasingSelect.value = config.animEasingType;
    if (animCustomEasingWrap) {
      animCustomEasingWrap.style.display = config.animEasingType === 'custom' ? 'block' : 'none';
    }
    if (animCustomEasingInput) animCustomEasingInput.value = config.animCustomEasing;

    // Minimap Container
    if (containerWidthSlider) containerWidthSlider.value = config.widthVw.toString();
    if (containerWidthVal) containerWidthVal.textContent = `${config.widthVw.toFixed(1)}vw`;
    if (containerHeightVal) containerHeightVal.textContent = `${config.heightVw.toFixed(1)}vw`;
    if (lockAspectCheck) lockAspectCheck.checked = config.followAspectRatio;
    if (flipTeamVal) flipTeamVal.textContent = simTargetTeam === 0 ? 'Blue (0°)' : 'Orange (180°)';
  }

  // --- Event Listeners ---

  // Pitch Boundary
  borderStrokeSlider?.addEventListener('input', () => {
    config.borderStrokeWidth = parseInt(borderStrokeSlider.value, 10);
    if (borderStrokeVal) borderStrokeVal.textContent = config.borderStrokeWidth.toString();
    syncConfigToOverlay();
  });

  borderColorPicker?.addEventListener('input', () => {
    config.borderColor = borderColorPicker.value;
    if (borderColorHex) borderColorHex.value = config.borderColor;
    syncConfigToOverlay();
  });
  borderColorHex?.addEventListener('change', () => {
    config.borderColor = borderColorHex.value;
    if (borderColorPicker) borderColorPicker.value = config.borderColor;
    syncConfigToOverlay();
  });

  borderOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(borderOpacitySlider.value, 10);
    config.borderOpacity = val / 100;
    if (borderOpacityVal) borderOpacityVal.textContent = `${val}%`;
    syncConfigToOverlay();
  });

  bgFillColorPicker?.addEventListener('input', () => {
    config.bgFillColor = bgFillColorPicker.value;
    if (bgFillColorHex) bgFillColorHex.value = config.bgFillColor;
    syncConfigToOverlay();
  });
  bgFillColorHex?.addEventListener('change', () => {
    config.bgFillColor = bgFillColorHex.value;
    if (bgFillColorPicker) bgFillColorPicker.value = config.bgFillColor;
    syncConfigToOverlay();
  });

  bgFillOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(bgFillOpacitySlider.value, 10);
    config.bgFillOpacity = val / 100;
    if (bgFillOpacityVal) bgFillOpacityVal.textContent = `${val}%`;
    syncConfigToOverlay();
  });

  pitchLineColorPicker?.addEventListener('input', () => {
    config.pitchLineColor = pitchLineColorPicker.value;
    if (pitchLineColorHex) pitchLineColorHex.value = config.pitchLineColor;
    syncConfigToOverlay();
  });
  pitchLineColorHex?.addEventListener('change', () => {
    config.pitchLineColor = pitchLineColorHex.value;
    if (pitchLineColorPicker) pitchLineColorPicker.value = config.pitchLineColor;
    syncConfigToOverlay();
  });

  pitchLineOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(pitchLineOpacitySlider.value, 10);
    config.pitchLineOpacity = val / 100;
    if (pitchLineOpacityVal) pitchLineOpacityVal.textContent = `${val}%`;
    syncConfigToOverlay();
  });

  // Boost Resources
  padRadiusSlider?.addEventListener('input', () => {
    config.padRadius = parseInt(padRadiusSlider.value, 10);
    if (padRadiusVal) padRadiusVal.textContent = `${config.padRadius} uu`;
    syncConfigToOverlay();
  });

  padColorPicker?.addEventListener('input', () => {
    config.padColor = padColorPicker.value;
    if (padColorHex) padColorHex.value = config.padColor;
    syncConfigToOverlay();
  });
  padColorHex?.addEventListener('change', () => {
    config.padColor = padColorHex.value;
    if (padColorPicker) padColorPicker.value = config.padColor;
    syncConfigToOverlay();
  });

  padOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(padOpacitySlider.value, 10);
    config.padOpacity = val / 100;
    if (padOpacityVal) padOpacityVal.textContent = `${val}%`;
    syncConfigToOverlay();
  });

  pillScaleSlider?.addEventListener('input', () => {
    const pct = parseInt(pillScaleSlider.value, 10);
    config.pillRadiusScale = pct / 100;
    if (pillScaleVal) pillScaleVal.textContent = `${pct}% (${config.pillRadiusScale.toFixed(1)}x)`;
    syncConfigToOverlay();
  });

  pillColorPicker?.addEventListener('input', () => {
    config.pillColor = pillColorPicker.value;
    if (pillColorHex) pillColorHex.value = config.pillColor;
    syncConfigToOverlay();
  });
  pillColorHex?.addEventListener('change', () => {
    config.pillColor = pillColorHex.value;
    if (pillColorPicker) pillColorPicker.value = config.pillColor;
    syncConfigToOverlay();
  });

  pillOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(pillOpacitySlider.value, 10);
    config.pillOpacity = val / 100;
    if (pillOpacityVal) pillOpacityVal.textContent = `${val}%`;
    syncConfigToOverlay();
  });

  // Center Dot
  dotRadiusSlider?.addEventListener('input', () => {
    config.dotRadius = parseInt(dotRadiusSlider.value, 10);
    if (dotRadiusVal) dotRadiusVal.textContent = `${config.dotRadius} px`;
    syncConfigToOverlay();
  });

  myDotColorPicker?.addEventListener('input', () => {
    config.myTeamDotColor = myDotColorPicker.value;
    if (myDotColorHex) myDotColorHex.value = config.myTeamDotColor;
    syncConfigToOverlay();
  });
  myDotColorHex?.addEventListener('change', () => {
    config.myTeamDotColor = myDotColorHex.value;
    if (myDotColorPicker) myDotColorPicker.value = config.myTeamDotColor;
    syncConfigToOverlay();
  });

  myDotOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(myDotOpacitySlider.value, 10);
    config.myTeamDotOpacity = val / 100;
    if (myDotOpacityVal) myDotOpacityVal.textContent = `${val}%`;
    syncConfigToOverlay();
  });

  oppDotColorPicker?.addEventListener('input', () => {
    config.oppTeamDotColor = oppDotColorPicker.value;
    if (oppDotColorHex) oppDotColorHex.value = config.oppTeamDotColor;
    syncConfigToOverlay();
  });
  oppDotColorHex?.addEventListener('change', () => {
    config.oppTeamDotColor = oppDotColorHex.value;
    if (oppDotColorPicker) oppDotColorPicker.value = config.oppTeamDotColor;
    syncConfigToOverlay();
  });

  oppDotOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(oppDotOpacitySlider.value, 10);
    config.oppTeamDotOpacity = val / 100;
    if (oppDotOpacityVal) oppDotOpacityVal.textContent = `${val}%`;
    syncConfigToOverlay();
  });

  // Outer Ring
  ringMaxPercentSlider?.addEventListener('input', () => {
    config.ringMaxPercent = parseInt(ringMaxPercentSlider.value, 10);
    if (ringMaxPercentVal) ringMaxPercentVal.textContent = `${config.ringMaxPercent}%`;
    syncConfigToOverlay();
  });

  ringBorderColorPicker?.addEventListener('input', () => {
    config.ringBorderColor = ringBorderColorPicker.value;
    if (ringBorderColorHex) ringBorderColorHex.value = config.ringBorderColor;
    syncConfigToOverlay();
  });
  ringBorderColorHex?.addEventListener('change', () => {
    config.ringBorderColor = ringBorderColorHex.value;
    if (ringBorderColorPicker) ringBorderColorPicker.value = config.ringBorderColor;
    syncConfigToOverlay();
  });

  ringBorderWidthSlider?.addEventListener('input', () => {
    config.ringBorderWidth = parseInt(ringBorderWidthSlider.value, 10);
    if (ringBorderWidthVal) ringBorderWidthVal.textContent = `${config.ringBorderWidth} px`;
    syncConfigToOverlay();
  });

  ringBorderOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(ringBorderOpacitySlider.value, 10);
    config.ringBorderOpacity = val / 100;
    if (ringBorderOpacityVal) ringBorderOpacityVal.textContent = `${val}%`;
    syncConfigToOverlay();
  });

  ringFillColorPicker?.addEventListener('input', () => {
    config.ringFillColor = ringFillColorPicker.value;
    if (ringFillColorHex) ringFillColorHex.value = config.ringFillColor;
    syncConfigToOverlay();
  });
  ringFillColorHex?.addEventListener('change', () => {
    config.ringFillColor = ringFillColorHex.value;
    if (ringFillColorPicker) ringFillColorPicker.value = config.ringFillColor;
    syncConfigToOverlay();
  });

  ringFillOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(ringFillOpacitySlider.value, 10);
    config.ringFillOpacity = val / 100;
    if (ringFillOpacityVal) ringFillOpacityVal.textContent = `${val}%`;
    syncConfigToOverlay();
  });

  ringPreviewCheck?.addEventListener('change', () => {
    config.ringPreviewActive = ringPreviewCheck.checked;
    syncConfigToOverlay();
  });

  ringPreviewSpeedSlider?.addEventListener('input', () => {
    config.ringPreviewSpeed = parseInt(ringPreviewSpeedSlider.value, 10);
    if (ringPreviewSpeedVal) ringPreviewSpeedVal.textContent = `${config.ringPreviewSpeed} KPH`;
    if (!config.ringPreviewActive && ringPreviewCheck) {
      config.ringPreviewActive = true;
      ringPreviewCheck.checked = true;
    }
    syncConfigToOverlay();
  });

  // Animation Controls
  animHoldSlider?.addEventListener('input', () => {
    config.animHoldDuration = parseFloat(animHoldSlider.value);
    if (animHoldVal) animHoldVal.textContent = `${config.animHoldDuration.toFixed(2)}s`;
    if (animTotalVal) animTotalVal.textContent = `${(config.animHoldDuration + config.animFadeDuration).toFixed(2)}s`;
    syncConfigToOverlay();
  });

  animFadeSlider?.addEventListener('input', () => {
    config.animFadeDuration = parseFloat(animFadeSlider.value);
    if (animFadeVal) animFadeVal.textContent = `${config.animFadeDuration.toFixed(2)}s`;
    if (animTotalVal) animTotalVal.textContent = `${(config.animHoldDuration + config.animFadeDuration).toFixed(2)}s`;
    syncConfigToOverlay();
  });

  animEasingSelect?.addEventListener('change', () => {
    config.animEasingType = animEasingSelect.value as any;
    if (animCustomEasingWrap) {
      animCustomEasingWrap.style.display = config.animEasingType === 'custom' ? 'block' : 'none';
    }
    syncConfigToOverlay();
  });

  animCustomEasingInput?.addEventListener('input', () => {
    config.animCustomEasing = animCustomEasingInput.value.trim();
    syncConfigToOverlay();
  });

  // Action Buttons
  btnSimMyHit?.addEventListener('click', () => {
    const spd = config.ringPreviewActive ? config.ringPreviewSpeed : 95;
    // Generate random pitch location for variety
    const rx = (Math.random() - 0.5) * 6000;
    const ry = (Math.random() - 0.5) * 8000;
    emitTo('overlay', 'ball-hit-svg-simulate', { x: rx, y: ry, speed: spd, isMyTeam: true });
  });

  btnSimOppHit?.addEventListener('click', () => {
    const spd = config.ringPreviewActive ? config.ringPreviewSpeed : 105;
    const rx = (Math.random() - 0.5) * 6000;
    const ry = (Math.random() - 0.5) * 8000;
    emitTo('overlay', 'ball-hit-svg-simulate', { x: rx, y: ry, speed: spd, isMyTeam: false });
  });

  btnToggle180Flip?.addEventListener('click', () => {
    simTargetTeam = simTargetTeam === 0 ? 1 : 0;
    if (flipTeamVal) flipTeamVal.textContent = simTargetTeam === 0 ? 'Blue (0°)' : 'Orange (180°)';
    emitTo('overlay', 'pitch-target-team-update', { targetTeam: simTargetTeam });
    emitTo('overlay', 'ball-hit-svg-target-team', { targetTeam: simTargetTeam });
  });

  // Minimap Container Controls
  containerWidthSlider?.addEventListener('input', () => {
    config.widthVw = parseFloat(containerWidthSlider.value);
    if (config.followAspectRatio) {
      config.heightVw = parseFloat((config.widthVw / 0.75).toFixed(2));
    }
    if (containerWidthVal) containerWidthVal.textContent = `${config.widthVw.toFixed(1)}vw`;
    if (containerHeightVal) containerHeightVal.textContent = `${config.heightVw.toFixed(1)}vw`;
    syncConfigToOverlay();
  });

  lockAspectCheck?.addEventListener('change', () => {
    config.followAspectRatio = lockAspectCheck.checked;
    if (config.followAspectRatio) {
      config.heightVw = parseFloat((config.widthVw / 0.75).toFixed(2));
      if (containerHeightVal) containerHeightVal.textContent = `${config.heightVw.toFixed(1)}vw`;
    }
    syncConfigToOverlay();
  });

  btnResetPos?.addEventListener('click', () => {
    config.leftVw = 38;
    config.topVw = 18;
    config.widthVw = 24;
    config.heightVw = 32;
    updateUI();
    syncConfigToOverlay();
  });

  btnResetAll?.addEventListener('click', () => {
    if (confirm('Reset all Ball Hit SVG & Minimap settings to defaults?')) {
      config = { ...DEFAULT_BALL_HIT_SVG_CONFIG };
      updateUI();
      syncConfigToOverlay();
    }
  });

  // Listen for config sync from overlay
  void listen<{ config: BallHitSvgConfig }>('ball-hit-svg-config-sync', (event) => {
    if (event.payload?.config) {
      config = event.payload.config;
      updateUI();
    }
  });

  updateUI();
}
