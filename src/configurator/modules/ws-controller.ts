import { emitTo, listen } from '@tauri-apps/api/event';

/**
 * ============================================================================
 * 🔌 WebSocket Controls & Mock Stream Controller
 * ============================================================================
 */

export function initWebSocketControls(): void {
  const wsHostInput = document.getElementById('ws-host-input') as HTMLInputElement | null;
  const wsPortInput = document.getElementById('ws-port-input') as HTMLInputElement | null;
  const wsStatusDot = document.getElementById('ws-status-dot');
  const wsStatusText = document.getElementById('ws-status-text');
  const wsToggleBtn = document.getElementById('ws-toggle-btn');
  const mockSimCheckbox = document.getElementById('mock-simulation-check') as HTMLInputElement | null;
  const autoRetryCheckbox = document.getElementById('ws-disable-retry-check') as HTMLInputElement | null;

  let currentWsStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';

  const savedHost = localStorage.getItem('saved_ws_host') || '127.0.0.1';
  const savedPort = localStorage.getItem('saved_ws_port') || '52950';
  if (wsHostInput) wsHostInput.value = savedHost;
  if (wsPortInput) wsPortInput.value = savedPort;

  const savedSim = localStorage.getItem('saved_mock_sim') === 'true';
  if (mockSimCheckbox) mockSimCheckbox.checked = savedSim;

  const savedDisableRetry = localStorage.getItem('saved_ws_disable_retry') === 'true';
  if (autoRetryCheckbox) autoRetryCheckbox.checked = savedDisableRetry;

  function updateWsUI(status: 'connected' | 'connecting' | 'disconnected') {
    currentWsStatus = status;
    if (wsStatusDot) {
      wsStatusDot.className = `status-dot ${
        status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected'
      }`;
    }
    if (wsStatusText) {
      wsStatusText.textContent =
        status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected';
      wsStatusText.style.color =
        status === 'connected' ? 'var(--primer-success-fg)' : status === 'connecting' ? 'var(--primer-attention-fg)' : 'var(--primer-danger-fg)';
    }
    if (wsToggleBtn) {
      if (status === 'connected') {
        wsToggleBtn.textContent = 'Disconnect';
        wsToggleBtn.className = 'btn btn-danger';
      } else if (status === 'connecting') {
        wsToggleBtn.textContent = 'Connecting...';
        wsToggleBtn.className = 'btn btn-secondary btn-disabled';
      } else {
        wsToggleBtn.textContent = 'Connect';
        wsToggleBtn.className = 'btn btn-primary';
      }
    }
  }

  wsToggleBtn?.addEventListener('click', () => {
    if (currentWsStatus === 'connected') {
      emitTo('overlay', 'ws-disconnect');
    } else {
      const host = wsHostInput?.value.trim() || '127.0.0.1';
      const port = wsPortInput?.value.trim() || '52950';
      localStorage.setItem('saved_ws_host', host);
      localStorage.setItem('saved_ws_port', port);
      emitTo('overlay', 'ws-connect', { host, port });
    }
  });

  mockSimCheckbox?.addEventListener('change', () => {
    const isSim = mockSimCheckbox.checked;
    localStorage.setItem('saved_mock_sim', isSim.toString());
    emitTo('overlay', 'toggle-mock-simulation', isSim);
    emitTo('overlay', 'toggle-mock-simulation', { enabled: isSim });
  });

  autoRetryCheckbox?.addEventListener('change', () => {
    const disableRetry = autoRetryCheckbox.checked;
    localStorage.setItem('saved_ws_disable_retry', disableRetry.toString());
    emitTo('overlay', 'toggle-ws-auto-retry', { disabled: disableRetry });
  });

  listen<{ status: 'connected' | 'connecting' | 'disconnected'; host: string; port: string }>(
    'ws-status-changed',
    (event) => {
      updateWsUI(event.payload.status);
    }
  );

  if (savedSim) {
    emitTo('overlay', 'toggle-mock-simulation', true);
    emitTo('overlay', 'toggle-mock-simulation', { enabled: true });
  }

  if (savedDisableRetry) {
    emitTo('overlay', 'toggle-ws-auto-retry', { disabled: true });
  }
}
