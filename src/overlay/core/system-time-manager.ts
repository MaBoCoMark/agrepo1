import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface SystemTimeConfig {
  visible: boolean;
  font_size_vw: number; // e.g. 1.2 vw
  text_color: string; // hex
  text_opacity: number; // 0 - 100
  stroke_color: string; // hex
  stroke_opacity: number; // 0 - 100
  stroke_size_px: number; // 0.0 - 5.0, precision 0.1, mapped to vw
  background_color: string; // hex
  background_opacity: number; // 0 - 100
  border_radius_percent: number; // 0 - 50 (%)
  global_opacity: number; // 0 - 100 (%)
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
      return { ...DEFAULT_SYSTEM_TIME_CONFIG, ...parsed };
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

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth / 100;
  const fontSize = Math.max(10, currentConfig.font_size_vw * vw);
  const strokePx = (currentConfig.stroke_size_px / 19.2) * vw;
  const padH = Math.max(fontSize * 0.5, strokePx * 2.5);
  const padV = Math.max(fontSize * 0.25, strokePx * 2.5);

  // Monospace font styling
  const fontStr = `600 ${fontSize}px "GHMonoR", "Mona Sans Mono", monospace`;
  ctx.font = fontStr;

  // 5 fixed chars
  const timeText = `${hours}${colonOn ? ':' : ' '}${minutes}`;
  const textMetrics = ctx.measureText(timeText);
  const textWidth = Math.max(fontSize * 3.4, textMetrics.width);

  const totalWidth = Math.ceil(textWidth + padH * 2);
  const totalHeight = Math.ceil(fontSize * 1.35 + padV * 2);

  const targetWidthDpr = Math.round(totalWidth * dpr);
  const targetHeightDpr = Math.round(totalHeight * dpr);

  if (canvas.width !== targetWidthDpr || canvas.height !== targetHeightDpr) {
    canvas.width = targetWidthDpr;
    canvas.height = targetHeightDpr;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;
    container.style.width = `${totalWidth}px`;
    container.style.height = `${totalHeight}px`;
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  // 1. Background capsule with borderRadiusPercent (0% to 50%)
  if (currentConfig.background_opacity > 0) {
    ctx.fillStyle = hexToRgba(currentConfig.background_color, currentConfig.background_opacity);
    const radius = (totalHeight / 2) * (Math.max(0, Math.min(50, currentConfig.border_radius_percent)) / 50);
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(0, 0, totalWidth, totalHeight, radius);
    } else {
      ctx.rect(0, 0, totalWidth, totalHeight);
    }
    ctx.fill();
  }

  // 2. Pure Stroke (NO SHADOW, max 5px mapped to vw)
  ctx.font = fontStr;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const centerX = totalWidth / 2;
  const centerY = totalHeight / 2 + fontSize * 0.04;

  if (strokePx > 0 && currentConfig.stroke_opacity > 0) {
    ctx.strokeStyle = hexToRgba(currentConfig.stroke_color, currentConfig.stroke_opacity);
    ctx.lineWidth = strokePx * 2;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(timeText, centerX, centerY);
  }

  // 3. Text Fill
  if (currentConfig.text_opacity > 0) {
    ctx.fillStyle = hexToRgba(currentConfig.text_color, currentConfig.text_opacity);
    ctx.fillText(timeText, centerX, centerY);
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
  // 1. Synchronize configuration from Rust backend or localStorage
  try {
    const backendCfg = await invoke<SystemTimeConfig>('get_system_time_config');
    if (backendCfg) {
      currentConfig = { ...DEFAULT_SYSTEM_TIME_CONFIG, ...backendCfg };
      saveSystemTimeConfig(currentConfig);
    } else {
      currentConfig = loadSystemTimeConfig();
    }
  } catch {
    currentConfig = loadSystemTimeConfig();
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

  // 5. IPC listener for configuration updates from System Time Configurator
  await listen<SystemTimeConfig>('update-system-time-config', (e) => {
    if (e.payload) {
      currentConfig = { ...currentConfig, ...e.payload };
      saveSystemTimeConfig(currentConfig);
      drawTimeCanvas(lastHours, lastMinutes, colonState);
    }
  });

  // 6. IPC listener for visibility changes from Tray menu
  await listen<{ visible: boolean }>('system-time-visibility-changed', (e) => {
    if (typeof e.payload?.visible === 'boolean') {
      currentConfig.visible = e.payload.visible;
      saveSystemTimeConfig(currentConfig);
      drawTimeCanvas(lastHours, lastMinutes, colonState);
    }
  });
}
