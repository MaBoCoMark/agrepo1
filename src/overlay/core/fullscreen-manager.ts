import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { overlayState } from './telemetry-state';

export interface FullscreenState {
  isFullScreen: boolean;
  boundHotkey: string | null;
}

export const fullscreenState: FullscreenState = {
  isFullScreen: false,
  boundHotkey: null,
};

let toastTimeout: any = null;
let toastFadeTimeout: any = null;

export function showHotkeyToast(message: string, isError: boolean = false): void {
  const container = document.getElementById('hotkey-toast-container');
  if (!container) return;

  if (toastTimeout) clearTimeout(toastTimeout);
  if (toastFadeTimeout) clearTimeout(toastFadeTimeout);

  container.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = `hotkey-toast ${isError ? 'danger' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  toastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    toastFadeTimeout = setTimeout(() => {
      toast.remove();
    }, 500);
  }, 3000);
}

export function updateExitFullscreenPrompt(): void {
  const prompt = document.getElementById('exit-fullscreen-prompt');
  if (!prompt) return;

  const shouldShow = fullscreenState.isFullScreen && overlayState.isLayoutEditing && Boolean(fullscreenState.boundHotkey);
  if (shouldShow && fullscreenState.boundHotkey) {
    prompt.textContent = `Press ${fullscreenState.boundHotkey} to exit full screen`;
    prompt.style.display = 'block';
  } else {
    prompt.style.display = 'none';
  }
}

export async function initFullscreenManager(): Promise<void> {
  // 1. Listen for backend hotkey registration status
  await listen<{ success: boolean; key: string | null; is_fullscreen?: boolean }>('hotkey-status', (e) => {
    const payload = e.payload;
    if (!payload) return;

    if (payload.success && payload.key) {
      fullscreenState.boundHotkey = payload.key;
      if (payload.key === 'F12') {
        fullscreenState.isFullScreen = true;
        // F12 binds cleanly without toast notification
      } else {
        fullscreenState.isFullScreen = Boolean(payload.is_fullscreen);
        showHotkeyToast(`Full screen hot key binded to ${payload.key}.`, false);
      }
    } else {
      fullscreenState.boundHotkey = null;
      fullscreenState.isFullScreen = false;
      showHotkeyToast('Fail to bind full screen hotkey.', true);
    }
    updateExitFullscreenPrompt();
  });

  // 2. Listen for fullscreen changes triggered by hotkey or tray
  await listen<{ is_fullscreen: boolean; hotkey?: string | null }>('fullscreen-changed', (e) => {
    const payload = e.payload;
    if (!payload) return;

    fullscreenState.isFullScreen = payload.is_fullscreen;
    if (payload.hotkey !== undefined) {
      fullscreenState.boundHotkey = payload.hotkey;
    }
    updateExitFullscreenPrompt();
  });

  // 3. Fallback query to synchronize state if already emitted before listener registration
  try {
    const initialStatus = await invoke<{ success: boolean; key: string | null; is_fullscreen: boolean }>('get_hotkey_status');
    if (initialStatus) {
      if (initialStatus.success && initialStatus.key) {
        fullscreenState.boundHotkey = initialStatus.key;
        fullscreenState.isFullScreen = initialStatus.is_fullscreen;
        if (initialStatus.key !== 'F12') {
          showHotkeyToast(`Full screen hot key binded to ${initialStatus.key}.`, false);
        }
      } else {
        fullscreenState.boundHotkey = null;
        fullscreenState.isFullScreen = false;
        showHotkeyToast('Fail to bind full screen hotkey.', true);
      }
      updateExitFullscreenPrompt();
    }
  } catch {
    // Non-Tauri environment or command not yet ready
  }

  // 4. In-window keyboard shortcut handler (for when overlay window has focus)
  window.addEventListener('keydown', async (e) => {
    if (!fullscreenState.boundHotkey) return;

    const hotkey = fullscreenState.boundHotkey.trim();
    const isCtrlF12 = hotkey === 'Control + F12';

    let isMatch = false;
    if (isCtrlF12) {
      if (e.ctrlKey && (e.key === 'F12' || e.code === 'F12')) {
        isMatch = true;
      }
    } else {
      if (e.key === hotkey || e.code === hotkey) {
        isMatch = true;
      }
    }

    if (isMatch) {
      e.preventDefault();
      try {
        await invoke('toggle_fullscreen');
      } catch {
        // Toggle manually if command fails
        fullscreenState.isFullScreen = !fullscreenState.isFullScreen;
        updateExitFullscreenPrompt();
      }
    }
  });
}
