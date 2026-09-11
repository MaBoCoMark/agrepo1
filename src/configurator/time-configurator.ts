import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { initThemeController } from './modules/theme-controller';

export interface SystemTimeConfig {
  visible: boolean;
  font_size_vw: number;
  text_color: string;
  text_opacity: number;
  stroke_color: string;
  stroke_opacity: number;
  stroke_size_px: number;
  background_color: string;
  background_opacity: number;
  border_radius_percent: number;
  global_opacity: number;
}

export const DEFAULT_SYSTEM_TIME_CONFIG: SystemTimeConfig = {
  visible: true,
  font_size_vw: 1.2,
  text_color: '#ffffff',
  text_opacity: 100,
  stroke_color: '#000000',
  stroke_opacity: 100,
  stroke_size_px: 1.5,
  background_color: '#000000',
  background_opacity: 40,
  border_radius_percent: 20,
  global_opacity: 100,
};

const STORAGE_KEY = 'rl_system_time_config';

function loadFromLocal(): SystemTimeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SYSTEM_TIME_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_SYSTEM_TIME_CONFIG };
}

function saveToLocal(cfg: SystemTimeConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // fallback
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initThemeController();

  let config: SystemTimeConfig = loadFromLocal();

  // Elements
  const visibleCheck = document.getElementById('time-visible-check') as HTMLInputElement;
  const fontSizeSlider = document.getElementById('font-size-slider') as HTMLInputElement;
  const fontSizeBadge = document.getElementById('font-size-badge') as HTMLElement;
  const textColorPicker = document.getElementById('text-color-picker') as HTMLInputElement;
  const textColorHex = document.getElementById('text-color-hex') as HTMLInputElement;
  const textOpacitySlider = document.getElementById('text-opacity-slider') as HTMLInputElement;
  const textOpacityBadge = document.getElementById('text-opacity-badge') as HTMLElement;

  const strokeSizeSlider = document.getElementById('stroke-size-slider') as HTMLInputElement;
  const strokeSizeBadge = document.getElementById('stroke-size-badge') as HTMLElement;
  const strokeColorPicker = document.getElementById('stroke-color-picker') as HTMLInputElement;
  const strokeColorHex = document.getElementById('stroke-color-hex') as HTMLInputElement;
  const strokeOpacitySlider = document.getElementById('stroke-opacity-slider') as HTMLInputElement;
  const strokeOpacityBadge = document.getElementById('stroke-opacity-badge') as HTMLElement;

  const bgColorPicker = document.getElementById('bg-color-picker') as HTMLInputElement;
  const bgColorHex = document.getElementById('bg-color-hex') as HTMLInputElement;
  const bgOpacitySlider = document.getElementById('bg-opacity-slider') as HTMLInputElement;
  const bgOpacityBadge = document.getElementById('bg-opacity-badge') as HTMLElement;
  const radiusSlider = document.getElementById('radius-slider') as HTMLInputElement;
  const radiusBadge = document.getElementById('radius-badge') as HTMLElement;

  const globalOpacitySlider = document.getElementById('global-opacity-slider') as HTMLInputElement;
  const globalOpacityBadge = document.getElementById('global-opacity-badge') as HTMLElement;

  const btnReset = document.getElementById('btn-reset-defaults') as HTMLButtonElement;
  const btnClose = document.getElementById('btn-close-window') as HTMLButtonElement;

  function syncInputsFromConfig() {
    if (visibleCheck) visibleCheck.checked = config.visible;

    if (fontSizeSlider) fontSizeSlider.value = config.font_size_vw.toFixed(1);
    if (fontSizeBadge) fontSizeBadge.textContent = `${config.font_size_vw.toFixed(1)} vw`;

    if (textColorPicker) textColorPicker.value = config.text_color;
    if (textColorHex) textColorHex.value = config.text_color;
    if (textOpacitySlider) textOpacitySlider.value = String(config.text_opacity);
    if (textOpacityBadge) textOpacityBadge.textContent = `${config.text_opacity}%`;

    if (strokeSizeSlider) strokeSizeSlider.value = config.stroke_size_px.toFixed(1);
    if (strokeSizeBadge) {
      const vwVal = (config.stroke_size_px / 19.2).toFixed(2);
      strokeSizeBadge.textContent = `${config.stroke_size_px.toFixed(1)}px (${vwVal}vw)`;
    }
    if (strokeColorPicker) strokeColorPicker.value = config.stroke_color;
    if (strokeColorHex) strokeColorHex.value = config.stroke_color;
    if (strokeOpacitySlider) strokeOpacitySlider.value = String(config.stroke_opacity);
    if (strokeOpacityBadge) strokeOpacityBadge.textContent = `${config.stroke_opacity}%`;

    if (bgColorPicker) bgColorPicker.value = config.background_color;
    if (bgColorHex) bgColorHex.value = config.background_color;
    if (bgOpacitySlider) bgOpacitySlider.value = String(config.background_opacity);
    if (bgOpacityBadge) bgOpacityBadge.textContent = `${config.background_opacity}%`;

    if (radiusSlider) radiusSlider.value = String(config.border_radius_percent);
    if (radiusBadge) radiusBadge.textContent = `${config.border_radius_percent}%`;

    if (globalOpacitySlider) globalOpacitySlider.value = String(config.global_opacity);
    if (globalOpacityBadge) globalOpacityBadge.textContent = `${config.global_opacity}%`;
  }

  async function broadcastConfig() {
    saveToLocal(config);
    try {
      await invoke('save_system_time_config', { config });
    } catch {
      // Fallback emit if IPC command is not directly available
      emit('update-system-time-config', config);
    }
  }

  // Load configuration from Rust backend to ensure absolute synchronization
  try {
    const backendCfg = await invoke<SystemTimeConfig>('get_system_time_config');
    if (backendCfg) {
      config = { ...DEFAULT_SYSTEM_TIME_CONFIG, ...backendCfg };
      saveToLocal(config);
    }
  } catch {
    // Non-Tauri fallback
  }

  syncInputsFromConfig();

  // Event Listeners
  visibleCheck?.addEventListener('change', () => {
    config.visible = visibleCheck.checked;
    broadcastConfig();
  });

  fontSizeSlider?.addEventListener('input', () => {
    const val = parseFloat(fontSizeSlider.value);
    config.font_size_vw = val;
    if (fontSizeBadge) fontSizeBadge.textContent = `${val.toFixed(1)} vw`;
    broadcastConfig();
  });

  textColorPicker?.addEventListener('input', () => {
    config.text_color = textColorPicker.value;
    if (textColorHex) textColorHex.value = textColorPicker.value;
    broadcastConfig();
  });

  textColorHex?.addEventListener('change', () => {
    let val = textColorHex.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      config.text_color = val;
      if (textColorPicker) textColorPicker.value = val;
      broadcastConfig();
    }
  });

  textOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(textOpacitySlider.value, 10);
    config.text_opacity = val;
    if (textOpacityBadge) textOpacityBadge.textContent = `${val}%`;
    broadcastConfig();
  });

  strokeSizeSlider?.addEventListener('input', () => {
    const val = parseFloat(strokeSizeSlider.value);
    config.stroke_size_px = val;
    if (strokeSizeBadge) {
      const vwVal = (val / 19.2).toFixed(2);
      strokeSizeBadge.textContent = `${val.toFixed(1)}px (${vwVal}vw)`;
    }
    broadcastConfig();
  });

  strokeColorPicker?.addEventListener('input', () => {
    config.stroke_color = strokeColorPicker.value;
    if (strokeColorHex) strokeColorHex.value = strokeColorPicker.value;
    broadcastConfig();
  });

  strokeColorHex?.addEventListener('change', () => {
    let val = strokeColorHex.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      config.stroke_color = val;
      if (strokeColorPicker) strokeColorPicker.value = val;
      broadcastConfig();
    }
  });

  strokeOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(strokeOpacitySlider.value, 10);
    config.stroke_opacity = val;
    if (strokeOpacityBadge) strokeOpacityBadge.textContent = `${val}%`;
    broadcastConfig();
  });

  bgColorPicker?.addEventListener('input', () => {
    config.background_color = bgColorPicker.value;
    if (bgColorHex) bgColorHex.value = bgColorPicker.value;
    broadcastConfig();
  });

  bgColorHex?.addEventListener('change', () => {
    let val = bgColorHex.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      config.background_color = val;
      if (bgColorPicker) bgColorPicker.value = val;
      broadcastConfig();
    }
  });

  bgOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(bgOpacitySlider.value, 10);
    config.background_opacity = val;
    if (bgOpacityBadge) bgOpacityBadge.textContent = `${val}%`;
    broadcastConfig();
  });

  radiusSlider?.addEventListener('input', () => {
    const val = parseInt(radiusSlider.value, 10);
    config.border_radius_percent = val;
    if (radiusBadge) radiusBadge.textContent = `${val}%`;
    broadcastConfig();
  });

  globalOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(globalOpacitySlider.value, 10);
    config.global_opacity = val;
    if (globalOpacityBadge) globalOpacityBadge.textContent = `${val}%`;
    broadcastConfig();
  });

  btnReset?.addEventListener('click', () => {
    config = { ...DEFAULT_SYSTEM_TIME_CONFIG };
    syncInputsFromConfig();
    broadcastConfig();
  });

  btnClose?.addEventListener('click', () => {
    try {
      getCurrentWebviewWindow().close();
    } catch {
      window.close();
    }
  });

  // Listen to Tray checkbox toggle events
  await listen<{ visible: boolean }>('system-time-visibility-changed', (e) => {
    if (typeof e.payload?.visible === 'boolean') {
      config.visible = e.payload.visible;
      if (visibleCheck) visibleCheck.checked = config.visible;
      saveToLocal(config);
    }
  });
});
