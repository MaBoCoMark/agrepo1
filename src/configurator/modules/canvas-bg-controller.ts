import { emitTo } from '@tauri-apps/api/event';
import { hexToRgb } from './ui-controls';

/**
 * ============================================================================
 * 🎨 Canvas Background Controls
 * ============================================================================
 */

export function initCanvasBackgroundControls(): void {
  const bgTransparentRadio = document.getElementById('bg-mode-transparent') as HTMLInputElement | null;
  const bgSolidRadio = document.getElementById('bg-mode-solid') as HTMLInputElement | null;
  const solidControls = document.getElementById('bg-custom-controls');
  const bgColorPicker = document.getElementById('bg-color-picker') as HTMLInputElement | null;
  const bgHexInput = document.getElementById('bg-hex-input') as HTMLInputElement | null;
  const bgOpacitySlider = document.getElementById('bg-opacity-slider') as HTMLInputElement | null;
  const bgOpacityLabel = document.getElementById('bg-opacity-label');
  const bgRgbaInput = document.getElementById('bg-rgba-input') as HTMLInputElement | null;

  let currentMode = localStorage.getItem('saved_canvas_bg_mode') || 'transparent';
  let currentColor = localStorage.getItem('saved_canvas_bg_color') || '#0b0f19';
  let currentOpacity = parseInt(localStorage.getItem('saved_canvas_bg_opacity') || '100', 10);

  function applyBgToOverlay() {
    if (currentMode === 'transparent') {
      emitTo('overlay', 'change-overlay-bg', 'transparent');
      if (bgRgbaInput) bgRgbaInput.value = 'transparent';
    } else {
      const rgb = hexToRgb(currentColor) || { r: 11, g: 15, b: 25 };
      const a = currentOpacity / 100;
      const rgbaStr = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a.toFixed(2)})`;
      emitTo('overlay', 'change-overlay-bg', rgbaStr);
      if (bgRgbaInput) bgRgbaInput.value = rgbaStr;
    }
  }

  function updateUI() {
    if (bgTransparentRadio && bgSolidRadio) {
      bgTransparentRadio.checked = currentMode === 'transparent';
      bgSolidRadio.checked = currentMode === 'solid';
    }
    if (solidControls) {
      solidControls.style.display = currentMode === 'solid' ? 'flex' : 'none';
    }
    if (bgColorPicker) bgColorPicker.value = currentColor;
    if (bgHexInput) bgHexInput.value = currentColor;
    if (bgOpacitySlider) bgOpacitySlider.value = currentOpacity.toString();
    if (bgOpacityLabel) bgOpacityLabel.textContent = `${currentOpacity}%`;
    applyBgToOverlay();
  }

  bgTransparentRadio?.addEventListener('change', () => {
    if (bgTransparentRadio.checked) {
      currentMode = 'transparent';
      localStorage.setItem('saved_canvas_bg_mode', 'transparent');
      updateUI();
    }
  });

  bgSolidRadio?.addEventListener('change', () => {
    if (bgSolidRadio.checked) {
      currentMode = 'solid';
      localStorage.setItem('saved_canvas_bg_mode', 'solid');
      updateUI();
    }
  });

  bgColorPicker?.addEventListener('input', () => {
    currentColor = bgColorPicker.value;
    if (bgHexInput) bgHexInput.value = currentColor;
    localStorage.setItem('saved_canvas_bg_color', currentColor);
    applyBgToOverlay();
  });

  bgHexInput?.addEventListener('input', () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(bgHexInput.value)) {
      currentColor = bgHexInput.value;
      if (bgColorPicker) bgColorPicker.value = currentColor;
      localStorage.setItem('saved_canvas_bg_color', currentColor);
      applyBgToOverlay();
    }
  });

  bgOpacitySlider?.addEventListener('input', () => {
    currentOpacity = parseInt(bgOpacitySlider.value, 10);
    if (bgOpacityLabel) bgOpacityLabel.textContent = `${currentOpacity}%`;
    localStorage.setItem('saved_canvas_bg_opacity', currentOpacity.toString());
    applyBgToOverlay();
  });

  updateUI();
}
