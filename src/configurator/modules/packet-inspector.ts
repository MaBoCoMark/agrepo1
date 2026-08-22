import { emitTo, listen } from '@tauri-apps/api/event';
import { ALL_ROCKET_LEAGUE_EVENTS, DEFAULT_ACTIVE_EVENTS } from '../../overlay/core/rl-events';
import { matchesRegexOrQuery } from './ui-controls';

/**
 * ============================================================================
 * 🔍 Packet Inspector & Event Filter Manager
 * ============================================================================
 */

export function initPacketInspector(): void {
  const packetDisplay = document.getElementById('packet-display') as HTMLTextAreaElement | null;
  const captureBtn = document.getElementById('capture-packet-btn');
  const copyPacketBtn = document.getElementById('copy-packet-btn');
  const captureStatus = document.getElementById('capture-status');
  const activeEventsCount = document.getElementById('active-events-count');

  const btnOpenEventsMgr = document.getElementById('btn-open-events-mgr');
  const eventsMgrModal = document.getElementById('events-mgr-modal');
  const btnCloseEventsMgr = document.getElementById('btn-close-events-mgr');
  const eventRegexInput = document.getElementById('event-regex-input') as HTMLInputElement | null;
  const btnSelectAllFiltered = document.getElementById('btn-select-all-filtered');
  const btnCheckAllEvents = document.getElementById('btn-check-all-events');
  const btnClearAllEvents = document.getElementById('btn-clear-all-events');
  const eventsCheckboxContainer = document.getElementById('events-checkbox-container');
  const eventsSelectedSummary = document.getElementById('events-selected-summary');
  const btnApplyEvents = document.getElementById('btn-apply-events');

  let activeEvents: string[] = [...DEFAULT_ACTIVE_EVENTS];
  const savedActiveEvents = localStorage.getItem('saved_packet_events');
  if (savedActiveEvents) {
    try {
      const parsed = JSON.parse(savedActiveEvents);
      if (Array.isArray(parsed) && parsed.length > 0) {
        activeEvents = parsed;
      }
    } catch {
      // ignore
    }
  }

  function updateStatusSummary() {
    if (activeEventsCount) activeEventsCount.textContent = activeEvents.length.toString();
    if (eventsSelectedSummary) {
      eventsSelectedSummary.textContent = `Selected: ${activeEvents.length} / ${ALL_ROCKET_LEAGUE_EVENTS.length} events`;
    }
    if (captureStatus) {
      captureStatus.textContent = `Status: Idle (${activeEvents.length} Event${activeEvents.length === 1 ? '' : 's'} Active)`;
    }
  }

  function renderEventsList() {
    if (!eventsCheckboxContainer) return;
    eventsCheckboxContainer.innerHTML = '';

    const query = eventRegexInput?.value || '';

    ALL_ROCKET_LEAGUE_EVENTS.forEach((item) => {
      const isMatch = matchesRegexOrQuery(`${item.name} ${item.key} ${item.desc}`, query);
      if (!isMatch) return;

      const isChecked = activeEvents.includes(item.key);
      const label = document.createElement('label');
      label.className = `event-check-item ${isChecked ? 'active' : ''}`;
      label.style.display = 'flex';
      label.style.alignItems = 'flex-start';
      label.style.gap = '6px';
      label.style.padding = '4px 6px';
      label.style.borderRadius = '4px';
      label.style.cursor = 'pointer';
      label.style.fontSize = '11px';

      label.innerHTML = `
        <input type="checkbox" value="${item.key}" ${isChecked ? 'checked' : ''} style="margin-top: 2px; cursor: pointer;">
        <div style="flex: 1;">
          <div style="font-weight: 600; color: var(--primer-fg-default);">${item.name}</div>
          <div style="font-size: 10px; color: var(--primer-fg-muted);">${item.desc}</div>
        </div>
      `;

      const input = label.querySelector('input')!;
      input.addEventListener('change', () => {
        if (input.checked) {
          if (!activeEvents.includes(item.key)) activeEvents.push(item.key);
          label.classList.add('active');
        } else {
          activeEvents = activeEvents.filter((k) => k !== item.key);
          label.classList.remove('active');
        }
        updateStatusSummary();
      });

      eventsCheckboxContainer.appendChild(label);
    });

    updateStatusSummary();
  }

  function syncEventsToOverlay() {
    localStorage.setItem('saved_packet_events', JSON.stringify(activeEvents));
    emitTo('overlay', 'set-active-capture-events', { events: activeEvents });
    updateStatusSummary();
  }

  btnOpenEventsMgr?.addEventListener('click', () => {
    if (eventsMgrModal) eventsMgrModal.style.display = 'flex';
    renderEventsList();
  });

  btnCloseEventsMgr?.addEventListener('click', () => {
    if (eventsMgrModal) eventsMgrModal.style.display = 'none';
    syncEventsToOverlay();
  });

  btnApplyEvents?.addEventListener('click', () => {
    if (eventsMgrModal) eventsMgrModal.style.display = 'none';
    syncEventsToOverlay();
  });

  eventRegexInput?.addEventListener('input', renderEventsList);

  btnSelectAllFiltered?.addEventListener('click', () => {
    const query = eventRegexInput?.value || '';
    const filteredKeys: string[] = [];
    ALL_ROCKET_LEAGUE_EVENTS.forEach((item) => {
      if (matchesRegexOrQuery(`${item.name} ${item.key} ${item.desc}`, query)) {
        filteredKeys.push(item.key);
      }
    });
    activeEvents = filteredKeys;
    renderEventsList();
  });

  btnCheckAllEvents?.addEventListener('click', () => {
    activeEvents = ALL_ROCKET_LEAGUE_EVENTS.map((it) => it.key);
    renderEventsList();
  });

  btnClearAllEvents?.addEventListener('click', () => {
    activeEvents = [];
    renderEventsList();
  });

  captureBtn?.addEventListener('click', () => {
    if (captureStatus) {
      captureStatus.textContent = 'Status: Arming capture (waiting for next packet)...';
      captureStatus.style.color = 'var(--primer-attention-fg)';
    }
    emitTo('overlay', 'request-packet-capture', { events: activeEvents });
  });

  copyPacketBtn?.addEventListener('click', async () => {
    if (packetDisplay && packetDisplay.value) {
      try {
        await navigator.clipboard.writeText(packetDisplay.value);
        const orig = copyPacketBtn.textContent;
        copyPacketBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyPacketBtn.textContent = orig;
        }, 1200);
      } catch {
        alert('Failed to copy to clipboard');
      }
    }
  });

  listen<{ packet: any; event: string }>('packet-captured', (event) => {
    if (packetDisplay) {
      packetDisplay.value = JSON.stringify(event.payload.packet, null, 2);
    }
    if (captureStatus) {
      captureStatus.textContent = `Status: Captured packet [${event.payload.event}]`;
      captureStatus.style.color = 'var(--primer-success-fg)';
    }
  });

  syncEventsToOverlay();
}
