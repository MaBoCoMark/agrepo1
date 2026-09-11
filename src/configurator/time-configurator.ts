import { emit, listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { initThemeController } from './modules/theme-controller';

export interface SystemTimeConfig {
  visible: boolean;
  font_size_vw: number;
  text_color: string;
  text_opacity: number;
  stroke_color: string;
  stroke_opacity: number;
  stroke_size_vw: number;
  stroke_size_px?: number;
  background_color: string;
  background_opacity: number;
  border_radius_percent: number;
  global_opacity: number;
  padding_x_vw: number;
  padding_y_vw: number;
  offset_top_vw: number;
  offset_right_vw: number;
}

export const DEFAULT_SYSTEM_TIME_CONFIG: SystemTimeConfig = {
  visible: true,
  font_size_vw: 1.2,
  text_color: '#ffffff',
  text_opacity: 100,
  stroke_color: '#000000',
  stroke_opacity: 100,
  stroke_size_vw: 0.08,
  stroke_size_px: 1.5,
  background_color: '#000000',
  background_opacity: 40,
  border_radius_percent: 20,
  global_opacity: 100,
  padding_x_vw: 0.4,
  padding_y_vw: 0.2,
  offset_top_vw: 0.8,
  offset_right_vw: 1.0,
};

const STORAGE_KEY = 'rl_system_time_config';

function normalizeConfig(raw?: Partial<SystemTimeConfig> | null): SystemTimeConfig {
  if (!raw) return { ...DEFAULT_SYSTEM_TIME_CONFIG };
  const res: SystemTimeConfig = { ...DEFAULT_SYSTEM_TIME_CONFIG, ...raw };

  if (raw.stroke_size_vw === undefined && raw.stroke_size_px !== undefined) {
    res.stroke_size_vw = parseFloat((raw.stroke_size_px / 19.2).toFixed(2));
  }

  if (typeof res.stroke_size_vw !== 'number' || isNaN(res.stroke_size_vw)) {
    res.stroke_size_vw = DEFAULT_SYSTEM_TIME_CONFIG.stroke_size_vw;
  }
  if (typeof res.padding_x_vw !== 'number' || isNaN(res.padding_x_vw)) {
    res.padding_x_vw = DEFAULT_SYSTEM_TIME_CONFIG.padding_x_vw;
  }
  if (typeof res.padding_y_vw !== 'number' || isNaN(res.padding_y_vw)) {
    res.padding_y_vw = DEFAULT_SYSTEM_TIME_CONFIG.padding_y_vw;
  }
  if (typeof res.offset_top_vw !== 'number' || isNaN(res.offset_top_vw)) {
    res.offset_top_vw = DEFAULT_SYSTEM_TIME_CONFIG.offset_top_vw;
  }
  if (typeof res.offset_right_vw !== 'number' || isNaN(res.offset_right_vw)) {
    res.offset_right_vw = DEFAULT_SYSTEM_TIME_CONFIG.offset_right_vw;
  }

  res.stroke_size_px = parseFloat((res.stroke_size_vw * 19.2).toFixed(1));
  return res;
}

function loadFromLocal(): SystemTimeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeConfig(JSON.parse(raw));
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

  let hasLocalConfig = false;
  try {
    hasLocalConfig = localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // fallback
  }

  let config: SystemTimeConfig = loadFromLocal();

  // If local config exists, make sure backend is in sync
  if (hasLocalConfig) {
    try {
      const currentVis = await invoke<boolean>('get_system_time_visible');
      if (typeof currentVis === 'boolean') {
        config.visible = currentVis;
      }
    } catch {
      // Non-Tauri fallback
    }
    try {
      await invoke('save_system_time_config', { config });
    } catch {
      // Non-Tauri fallback
    }
  } else {
    // Only fall back to backend if no local config was stored yet
    try {
      const backendCfg = await invoke<SystemTimeConfig>('get_system_time_config');
      if (backendCfg) {
        config = normalizeConfig(backendCfg);
      }
    } catch {
      // Non-Tauri fallback
    }
  }

  // DOM Elements
  const visibleCheck = document.getElementById('time-visible-check') as HTMLInputElement | null;
  const fontSizeSlider = document.getElementById('font-size-slider') as HTMLInputElement | null;
  const fontSizeBadge = document.getElementById('font-size-badge') as HTMLElement | null;
  const textColorPicker = document.getElementById('text-color-picker') as HTMLInputElement | null;
  const textColorHex = document.getElementById('text-color-hex') as HTMLInputElement | null;
  const textOpacitySlider = document.getElementById('text-opacity-slider') as HTMLInputElement | null;
  const textOpacityBadge = document.getElementById('text-opacity-badge') as HTMLElement | null;

  const strokeSizeSlider = document.getElementById('stroke-size-slider') as HTMLInputElement | null;
  const strokeSizeBadge = document.getElementById('stroke-size-badge') as HTMLElement | null;
  const strokeColorPicker = document.getElementById('stroke-color-picker') as HTMLInputElement | null;
  const strokeColorHex = document.getElementById('stroke-color-hex') as HTMLInputElement | null;
  const strokeOpacitySlider = document.getElementById('stroke-opacity-slider') as HTMLInputElement | null;
  const strokeOpacityBadge = document.getElementById('stroke-opacity-badge') as HTMLElement | null;

  const bgColorPicker = document.getElementById('bg-color-picker') as HTMLInputElement | null;
  const bgColorHex = document.getElementById('bg-color-hex') as HTMLInputElement | null;
  const bgOpacitySlider = document.getElementById('bg-opacity-slider') as HTMLInputElement | null;
  const bgOpacityBadge = document.getElementById('bg-opacity-badge') as HTMLElement | null;
  const radiusSlider = document.getElementById('radius-slider') as HTMLInputElement | null;
  const radiusBadge = document.getElementById('radius-badge') as HTMLElement | null;

  const paddingXSlider = document.getElementById('padding-x-slider') as HTMLInputElement | null;
  const paddingXBadge = document.getElementById('padding-x-badge') as HTMLElement | null;
  const paddingYSlider = document.getElementById('padding-y-slider') as HTMLInputElement | null;
  const paddingYBadge = document.getElementById('padding-y-badge') as HTMLElement | null;

  const offsetTopSlider = document.getElementById('offset-top-slider') as HTMLInputElement | null;
  const offsetTopBadge = document.getElementById('offset-top-badge') as HTMLElement | null;
  const offsetRightSlider = document.getElementById('offset-right-slider') as HTMLInputElement | null;
  const offsetRightBadge = document.getElementById('offset-right-badge') as HTMLElement | null;

  const globalOpacitySlider = document.getElementById('global-opacity-slider') as HTMLInputElement | null;
  const globalOpacityBadge = document.getElementById('global-opacity-badge') as HTMLElement | null;

  const btnReset = document.getElementById('btn-reset-defaults') as HTMLButtonElement | null;

  function syncInputsFromConfig() {
    if (visibleCheck) visibleCheck.checked = config.visible;

    if (fontSizeSlider) fontSizeSlider.value = config.font_size_vw.toFixed(1);
    if (fontSizeBadge) fontSizeBadge.textContent = `${config.font_size_vw.toFixed(1)} vw`;

    if (textColorPicker) textColorPicker.value = config.text_color;
    if (textColorHex) textColorHex.value = config.text_color;
    if (textOpacitySlider) textOpacitySlider.value = String(config.text_opacity);
    if (textOpacityBadge) textOpacityBadge.textContent = `${config.text_opacity}%`;

    if (strokeSizeSlider) strokeSizeSlider.value = config.stroke_size_vw.toFixed(2);
    if (strokeSizeBadge) strokeSizeBadge.textContent = `${config.stroke_size_vw.toFixed(2)} vw`;

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

    if (paddingXSlider) paddingXSlider.value = config.padding_x_vw.toFixed(2);
    if (paddingXBadge) paddingXBadge.textContent = `${config.padding_x_vw.toFixed(2)} vw`;

    if (paddingYSlider) paddingYSlider.value = config.padding_y_vw.toFixed(2);
    if (paddingYBadge) paddingYBadge.textContent = `${config.padding_y_vw.toFixed(2)} vw`;

    if (offsetTopSlider) offsetTopSlider.value = config.offset_top_vw.toFixed(2);
    if (offsetTopBadge) offsetTopBadge.textContent = `${config.offset_top_vw.toFixed(2)} vw`;

    if (offsetRightSlider) offsetRightSlider.value = config.offset_right_vw.toFixed(2);
    if (offsetRightBadge) offsetRightBadge.textContent = `${config.offset_right_vw.toFixed(2)} vw`;

    if (globalOpacitySlider) globalOpacitySlider.value = String(config.global_opacity);
    if (globalOpacityBadge) globalOpacityBadge.textContent = `${config.global_opacity}%`;
  }

  // Real-time preview function: emits update to memory without waiting for disk flush
  function broadcastPreview() {
    config.stroke_size_px = parseFloat((config.stroke_size_vw * 19.2).toFixed(1));
    try {
      emit('update-system-time-config', config);
    } catch {
      // Non-Tauri fallback
    }
  }

  // Immediate save helper with debounced IPC invoke to ensure persistence across closing and reopening
  let debounceSaveTimer: ReturnType<typeof setTimeout> | null = null;
  function onConfigChanged(commitImmediate = false) {
    config.stroke_size_px = parseFloat((config.stroke_size_vw * 19.2).toFixed(1));
    saveToLocal(config);
    broadcastPreview();

    if (commitImmediate) {
      if (debounceSaveTimer) {
        clearTimeout(debounceSaveTimer);
        debounceSaveTimer = null;
      }
      try {
        invoke('save_system_time_config', { config });
      } catch {
        // Non-Tauri fallback
      }
      try {
        emit('save-system-time-config', config);
      } catch {
        // Non-Tauri fallback
      }
    } else {
      if (debounceSaveTimer) clearTimeout(debounceSaveTimer);
      debounceSaveTimer = setTimeout(() => {
        debounceSaveTimer = null;
        try {
          invoke('save_system_time_config', { config });
        } catch {
          // Non-Tauri fallback
        }
        try {
          emit('save-system-time-config', config);
        } catch {
          // Non-Tauri fallback
        }
      }, 100);
    }
  }

  // Save to persistent storage (localStorage and backend) upon closing / unloading
  function persistConfig() {
    config.stroke_size_px = parseFloat((config.stroke_size_vw * 19.2).toFixed(1));
    saveToLocal(config);
    try {
      invoke('save_system_time_config', { config });
    } catch {
      // Non-Tauri fallback
    }
    try {
      emit('save-system-time-config', config);
    } catch {
      // Non-Tauri fallback
    }
  }

  syncInputsFromConfig();

  // Event Listeners (all trigger real-time in-memory preview and persist state)
  visibleCheck?.addEventListener('change', () => {
    config.visible = visibleCheck.checked;
    onConfigChanged(true);
  });

  fontSizeSlider?.addEventListener('input', () => {
    const val = parseFloat(fontSizeSlider.value);
    config.font_size_vw = val;
    if (fontSizeBadge) fontSizeBadge.textContent = `${val.toFixed(1)} vw`;
    onConfigChanged(false);
  });
  fontSizeSlider?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  textColorPicker?.addEventListener('input', () => {
    config.text_color = textColorPicker.value;
    if (textColorHex) textColorHex.value = textColorPicker.value;
    onConfigChanged(false);
  });
  textColorPicker?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  textColorHex?.addEventListener('change', () => {
    let val = textColorHex.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      config.text_color = val;
      if (textColorPicker) textColorPicker.value = val;
      onConfigChanged(true);
    }
  });

  textOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(textOpacitySlider.value, 10);
    config.text_opacity = val;
    if (textOpacityBadge) textOpacityBadge.textContent = `${val}%`;
    onConfigChanged(false);
  });
  textOpacitySlider?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  strokeSizeSlider?.addEventListener('input', () => {
    const val = parseFloat(strokeSizeSlider.value);
    config.stroke_size_vw = val;
    if (strokeSizeBadge) {
      strokeSizeBadge.textContent = `${val.toFixed(2)} vw`;
    }
    onConfigChanged(false);
  });
  strokeSizeSlider?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  strokeColorPicker?.addEventListener('input', () => {
    config.stroke_color = strokeColorPicker.value;
    if (strokeColorHex) strokeColorHex.value = strokeColorPicker.value;
    onConfigChanged(false);
  });
  strokeColorPicker?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  strokeColorHex?.addEventListener('change', () => {
    let val = strokeColorHex.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      config.stroke_color = val;
      if (strokeColorPicker) strokeColorPicker.value = val;
      onConfigChanged(true);
    }
  });

  strokeOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(strokeOpacitySlider.value, 10);
    config.stroke_opacity = val;
    if (strokeOpacityBadge) strokeOpacityBadge.textContent = `${val}%`;
    onConfigChanged(false);
  });
  strokeOpacitySlider?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  bgColorPicker?.addEventListener('input', () => {
    config.background_color = bgColorPicker.value;
    if (bgColorHex) bgColorHex.value = bgColorPicker.value;
    onConfigChanged(false);
  });
  bgColorPicker?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  bgColorHex?.addEventListener('change', () => {
    let val = bgColorHex.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      config.background_color = val;
      if (bgColorPicker) bgColorPicker.value = val;
      onConfigChanged(true);
    }
  });

  bgOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(bgOpacitySlider.value, 10);
    config.background_opacity = val;
    if (bgOpacityBadge) bgOpacityBadge.textContent = `${val}%`;
    onConfigChanged(false);
  });
  bgOpacitySlider?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  radiusSlider?.addEventListener('input', () => {
    const val = parseInt(radiusSlider.value, 10);
    config.border_radius_percent = val;
    if (radiusBadge) radiusBadge.textContent = `${val}%`;
    onConfigChanged(false);
  });
  radiusSlider?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  paddingXSlider?.addEventListener('input', () => {
    const val = parseFloat(paddingXSlider.value);
    config.padding_x_vw = val;
    if (paddingXBadge) paddingXBadge.textContent = `${val.toFixed(2)} vw`;
    onConfigChanged(false);
  });
  paddingXSlider?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  paddingYSlider?.addEventListener('input', () => {
    const val = parseFloat(paddingYSlider.value);
    config.padding_y_vw = val;
    if (paddingYBadge) paddingYBadge.textContent = `${val.toFixed(2)} vw`;
    onConfigChanged(false);
  });
  paddingYSlider?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  offsetTopSlider?.addEventListener('input', () => {
    const val = parseFloat(offsetTopSlider.value);
    config.offset_top_vw = val;
    if (offsetTopBadge) offsetTopBadge.textContent = `${val.toFixed(2)} vw`;
    onConfigChanged(false);
  });
  offsetTopSlider?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  offsetRightSlider?.addEventListener('input', () => {
    const val = parseFloat(offsetRightSlider.value);
    config.offset_right_vw = val;
    if (offsetRightBadge) offsetRightBadge.textContent = `${val.toFixed(2)} vw`;
    onConfigChanged(false);
  });
  offsetRightSlider?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  globalOpacitySlider?.addEventListener('input', () => {
    const val = parseInt(globalOpacitySlider.value, 10);
    config.global_opacity = val;
    if (globalOpacityBadge) globalOpacityBadge.textContent = `${val}%`;
    onConfigChanged(false);
  });
  globalOpacitySlider?.addEventListener('change', () => {
    onConfigChanged(true);
  });

  btnReset?.addEventListener('click', () => {
    config = { ...DEFAULT_SYSTEM_TIME_CONFIG };
    syncInputsFromConfig();
    onConfigChanged(true);
  });

  window.addEventListener('beforeunload', () => {
    persistConfig();
  });

  window.addEventListener('pagehide', () => {
    persistConfig();
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
