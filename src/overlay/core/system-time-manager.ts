import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface SystemTimeConfig {
  visible: boolean;
  font_size_vw: number; // e.g. 1.2 vw
  text_color: string; // hex
  text_opacity: number; // 0 - 100
  stroke_color: string; // hex
  stroke_opacity: number; // 0 - 100
  stroke_size_vw: number; // 0.00 - 1.00 vw, step 0.01
  stroke_size_px?: number; // legacy backward compatibility
  background_color: string; // hex
  background_opacity: number; // 0 - 100
  border_radius_percent: number; // 0 - 50 (%)
  global_opacity: number; // 0 - 100 (%)
  padding_x_vw: number; // horizontal padding beyond text in vw
  padding_y_vw: number; // vertical padding beyond text in vw
  offset_top_vw: number; // offset from screen top in vw
  offset_right_vw: number; // offset from screen right in vw
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

export function normalizeSystemTimeConfig(raw?: Partial<SystemTimeConfig> | null): SystemTimeConfig {
  if (!raw) return { ...DEFAULT_SYSTEM_TIME_CONFIG };
  const res: SystemTimeConfig = { ...DEFAULT_SYSTEM_TIME_CONFIG, ...raw };

  // Backwards compatibility for stroke size
  if (raw.stroke_size_vw === undefined && raw.stroke_size_px !== undefined) {
    res.stroke_size_vw = parseFloat((raw.stroke_size_px / 19.2).toFixed(2));
  }

  // Ensure all numerical values are valid numbers
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

function hexToRgba(hex: string, opacity: number): string {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(255, 255, 255, ${opacity / 100})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${(opacity / 100).toFixed(3)})`;
}

let currentConfig: SystemTimeConfig = { ...DEFAULT_SYSTEM_TIME_CONFIG };
let colonState = true;
let lastHours = '00';
let lastMinutes = '00';

export function loadSystemTimeConfig(): SystemTimeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeSystemTimeConfig(parsed);
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_SYSTEM_TIME_CONFIG };
}

export function saveSystemTimeConfig(cfg: SystemTimeConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // fallback
  }
}

export function drawTimeCanvas(hours: string, minutes: string, colonOn: boolean): void {
  const container = document.getElementById('system-time-container');
  const canvas = document.getElementById('system-time-canvas') as HTMLCanvasElement | null;
  if (!container || !canvas) return;

  if (!currentConfig.visible) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';
  container.style.opacity = (currentConfig.global_opacity / 100).toString();

  // Screen corner offsets
  container.style.top = `${currentConfig.offset_top_vw}vw`;
  container.style.right = `${currentConfig.offset_right_vw}vw`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth / 100;
  const fontSize = Math.max(10, currentConfig.font_size_vw * vw);

  // Stroke size in vw converted to css pixels
  const strokeVw = currentConfig.stroke_size_vw ?? (currentConfig.stroke_size_px ? currentConfig.stroke_size_px / 19.2 : 0);
  const strokePx = Math.max(0, strokeVw * vw);

  // Box paddings (how much background capsule extends beyond text) in vw converted to css pixels
  const padH = Math.max(0, currentConfig.padding_x_vw * vw);
  const padV = Math.max(0, currentConfig.padding_y_vw * vw);

  // Monospace font styling
  const fontStr = `600 ${fontSize}px "GHMonoR", "Mona Sans Mono", monospace`;
  ctx.font = fontStr;

  // Measure stable 5-char reference text so dimensions do not flicker when colon blinks
  const refMetrics = ctx.measureText('88:88');
  const textWidth = Math.max(fontSize * 3.1, refMetrics.width);

  // Measure visual vertical height of digits (ascent + descent)
  let textAscent = refMetrics.actualBoundingBoxAscent;
  let textDescent = refMetrics.actualBoundingBoxDescent;
  if (!textAscent || textAscent <= 0) {
    textAscent = fontSize * 0.72;
    textDescent = fontSize * 0.08;
  } else if (textDescent === undefined || textDescent < 0) {
    textDescent = fontSize * 0.08;
  }
  const textHeight = Math.ceil(textAscent + textDescent);

  // Dimensions of the outer box (capsule / background)
  const boxWidth = Math.ceil(textWidth + padH * 2);
  const boxHeight = Math.ceil(textHeight + padV * 2);

  // Extra canvas bleed margin if stroke extends outside the outer box (e.g. when padH < strokePx)
  const bleedH = (strokePx > 0 && currentConfig.stroke_opacity > 0) ? Math.max(0, Math.ceil(strokePx - padH)) : 0;
  const bleedV = (strokePx > 0 && currentConfig.stroke_opacity > 0) ? Math.max(0, Math.ceil(strokePx - padV)) : 0;

  const totalWidth = boxWidth + bleedH * 2;
  const totalHeight = boxHeight + bleedV * 2;

  const targetWidthDpr = Math.round(totalWidth * dpr);
  const targetHeightDpr = Math.round(totalHeight * dpr);

  if (canvas.width !== targetWidthDpr || canvas.height !== targetHeightDpr) {
    canvas.width = targetWidthDpr;
    canvas.height = targetHeightDpr;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;
  }

  // Ensure container size accurately matches the background box
  container.style.width = `${boxWidth}px`;
  container.style.height = `${boxHeight}px`;

  if (bleedH > 0 || bleedV > 0) {
    canvas.style.position = 'absolute';
    canvas.style.left = `-${bleedH}px`;
    canvas.style.top = `-${bleedV}px`;
  } else {
    canvas.style.position = 'relative';
    canvas.style.left = '0px';
    canvas.style.top = '0px';
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  const boxX = bleedH;
  const boxY = bleedV;

  // 1. Background capsule with borderRadiusPercent (0% to 50%)
  if (currentConfig.background_opacity > 0) {
    ctx.fillStyle = hexToRgba(currentConfig.background_color, currentConfig.background_opacity);
    const radius = (boxHeight / 2) * (Math.max(0, Math.min(50, currentConfig.border_radius_percent)) / 50);
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(boxX, boxY, boxWidth, boxHeight, radius);
    } else {
      ctx.rect(boxX, boxY, boxWidth, boxHeight);
    }
    ctx.fill();
  }

  // 2. Stroke and Text Fill
  const timeText = `${hours}${colonOn ? ':' : ' '}${minutes}`;
  ctx.font = fontStr;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const centerX = boxX + boxWidth / 2;
  const baselineY = boxY + padV + textAscent;

  if (strokePx > 0 && currentConfig.stroke_opacity > 0) {
    ctx.strokeStyle = hexToRgba(currentConfig.stroke_color, currentConfig.stroke_opacity);
    ctx.lineWidth = strokePx * 2;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(timeText, centerX, baselineY);
  }

  if (currentConfig.text_opacity > 0) {
    ctx.fillStyle = hexToRgba(currentConfig.text_color, currentConfig.text_opacity);
    ctx.fillText(timeText, centerX, baselineY);
  }

  ctx.restore();
}

export function tickSystemTime(): void {
  // Actively read system time
  const now = new Date();
  lastHours = String(now.getHours()).padStart(2, '0');
  lastMinutes = String(now.getMinutes()).padStart(2, '0');

  // Toggle colon state on each successful system time tick
  colonState = !colonState;
  drawTimeCanvas(lastHours, lastMinutes, colonState);
}

export async function initSystemTime(): Promise<void> {
  // 1. Synchronize configuration from localStorage (persistent storage)
  let hasLocalConfig = false;
  try {
    hasLocalConfig = localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // fallback
  }

  currentConfig = loadSystemTimeConfig();

  // If local config exists, push it to the Rust backend so Tray menu and backend stay synchronized
  if (hasLocalConfig) {
    try {
      await invoke('save_system_time_config', { config: currentConfig });
    } catch {
      // Non-Tauri fallback
    }
  } else {
    // First time running without local storage: attempt loading from backend
    try {
      const backendCfg = await invoke<SystemTimeConfig>('get_system_time_config');
      if (backendCfg) {
        currentConfig = normalizeSystemTimeConfig(backendCfg);
      }
    } catch {
      // Non-Tauri fallback
    }
  }

  // 2. Initial draw
  const now = new Date();
  lastHours = String(now.getHours()).padStart(2, '0');
  lastMinutes = String(now.getMinutes()).padStart(2, '0');
  colonState = true;
  drawTimeCanvas(lastHours, lastMinutes, colonState);

  // 3. Regular active timer: reads clock and flashes colon
  setInterval(tickSystemTime, 1000);

  // 4. Redraw on window resize (for vw updates)
  window.addEventListener('resize', () => {
    drawTimeCanvas(lastHours, lastMinutes, colonState);
  });

  // 5. IPC listener for configuration updates from System Time Configurator (real-time in-memory preview)
  await listen<SystemTimeConfig>('update-system-time-config', (e) => {
    if (e.payload) {
      currentConfig = normalizeSystemTimeConfig(e.payload);
      // Real-time preview: redraw canvas in memory without writing to disk / localStorage!
      drawTimeCanvas(lastHours, lastMinutes, colonState);
    }
  });

  // 6. IPC listener for configuration saved event
  await listen<SystemTimeConfig>('save-system-time-config', (e) => {
    if (e.payload) {
      currentConfig = normalizeSystemTimeConfig(e.payload);
      saveSystemTimeConfig(currentConfig);
      drawTimeCanvas(lastHours, lastMinutes, colonState);
    }
  });

  // 7. IPC listener for visibility changes from Tray menu
  await listen<{ visible: boolean }>('system-time-visibility-changed', (e) => {
    if (typeof e.payload?.visible === 'boolean') {
      currentConfig.visible = e.payload.visible;
      saveSystemTimeConfig(currentConfig);
      drawTimeCanvas(lastHours, lastMinutes, colonState);
    }
  });
}
