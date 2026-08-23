import { emitTo } from '@tauri-apps/api/event';
import {
  ALL_ROCKET_LEAGUE_EVENTS,
  DEFAULT_LOW_FREQ_TRIGGERS,
  DEFAULT_TIMELINE_EVENTS
} from '../../overlay/core/rl-events';
import { matchesRegexOrQuery } from './ui-controls';

/**
 * ============================================================================
 * ⏱️ Telemetry Low-Frequency Triggers & Timeline Console Logger Controller
 * ============================================================================
 */

export function initTelemetrySyncController(): void {
  // --------------------------------------------------------------------------
  // 1. Low-Frequency Telemetry Synchronization Manager
  // --------------------------------------------------------------------------
  const lowFreqStatus = document.getElementById('low-freq-status');
  const lowFreqEventsCount = document.getElementById('low-freq-events-count');
  const btnOpenLowFreqMgr = document.getElementById('btn-open-low-freq-mgr');
  const btnTriggerLowFreqSync = document.getElementById('btn-trigger-low-freq-sync');
  const lowFreqModal = document.getElementById('low-freq-modal');
  const btnCloseLowFreqMgr = document.getElementById('btn-close-low-freq-mgr');
  const btnApplyLowFreq = document.getElementById('btn-apply-low-freq');
  const lowFreqRegexInput = document.getElementById('low-freq-regex-input') as HTMLInputElement | null;
  const btnLowFreqSelectFiltered = document.getElementById('btn-low-freq-select-filtered');
  const btnLowFreqCheckAll = document.getElementById('btn-low-freq-check-all');
  const btnLowFreqResetDefault = document.getElementById('btn-low-freq-reset-default');
  const btnLowFreqClearAll = document.getElementById('btn-low-freq-clear-all');
  const lowFreqCheckboxContainer = document.getElementById('low-freq-checkbox-container');
  const lowFreqSelectedSummary = document.getElementById('low-freq-selected-summary');

  let activeLowFreqTriggers: string[] = [...DEFAULT_LOW_FREQ_TRIGGERS];
  const savedLowFreq = localStorage.getItem('saved_low_freq_triggers');
  if (savedLowFreq) {
    try {
      const parsed = JSON.parse(savedLowFreq);
      if (Array.isArray(parsed) && parsed.length > 0) {
        activeLowFreqTriggers = parsed;
      }
    } catch {
      // ignore
    }
  }

  function updateLowFreqSummary() {
    if (lowFreqEventsCount) lowFreqEventsCount.textContent = activeLowFreqTriggers.length.toString();
    if (lowFreqSelectedSummary) {
      lowFreqSelectedSummary.textContent = `Selected: ${activeLowFreqTriggers.length} / ${ALL_ROCKET_LEAGUE_EVENTS.length} events`;
    }
    if (lowFreqStatus) {
      lowFreqStatus.textContent = `Active: ${activeLowFreqTriggers.length} Trigger Event${activeLowFreqTriggers.length === 1 ? '' : 's'}`;
    }
  }

  function renderLowFreqList() {
    if (!lowFreqCheckboxContainer) return;
    lowFreqCheckboxContainer.innerHTML = '';

    const query = lowFreqRegexInput?.value || '';

    ALL_ROCKET_LEAGUE_EVENTS.forEach((item) => {
      const isMatch = matchesRegexOrQuery(`${item.name} ${item.key} ${item.desc}`, query);
      if (!isMatch) return;

      const isChecked = activeLowFreqTriggers.includes(item.key);
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
          if (!activeLowFreqTriggers.includes(item.key)) activeLowFreqTriggers.push(item.key);
          label.classList.add('active');
        } else {
          activeLowFreqTriggers = activeLowFreqTriggers.filter((k) => k !== item.key);
          label.classList.remove('active');
        }
        updateLowFreqSummary();
      });

      lowFreqCheckboxContainer.appendChild(label);
    });

    updateLowFreqSummary();
  }

  function syncLowFreqToOverlay() {
    localStorage.setItem('saved_low_freq_triggers', JSON.stringify(activeLowFreqTriggers));
    emitTo('overlay', 'set-low-freq-triggers', { events: activeLowFreqTriggers });
    updateLowFreqSummary();
  }

  btnOpenLowFreqMgr?.addEventListener('click', () => {
    if (lowFreqModal) lowFreqModal.style.display = 'flex';
    renderLowFreqList();
  });

  btnCloseLowFreqMgr?.addEventListener('click', () => {
    if (lowFreqModal) lowFreqModal.style.display = 'none';
    syncLowFreqToOverlay();
  });

  btnApplyLowFreq?.addEventListener('click', () => {
    if (lowFreqModal) lowFreqModal.style.display = 'none';
    syncLowFreqToOverlay();
  });

  lowFreqRegexInput?.addEventListener('input', renderLowFreqList);

  btnLowFreqSelectFiltered?.addEventListener('click', () => {
    const query = lowFreqRegexInput?.value || '';
    const filteredKeys: string[] = [];
    ALL_ROCKET_LEAGUE_EVENTS.forEach((item) => {
      if (matchesRegexOrQuery(`${item.name} ${item.key} ${item.desc}`, query)) {
        filteredKeys.push(item.key);
      }
    });
    activeLowFreqTriggers = filteredKeys;
    renderLowFreqList();
  });

  btnLowFreqCheckAll?.addEventListener('click', () => {
    activeLowFreqTriggers = ALL_ROCKET_LEAGUE_EVENTS.map((it) => it.key);
    renderLowFreqList();
  });

  btnLowFreqResetDefault?.addEventListener('click', () => {
    activeLowFreqTriggers = [...DEFAULT_LOW_FREQ_TRIGGERS];
    renderLowFreqList();
  });

  btnLowFreqClearAll?.addEventListener('click', () => {
    activeLowFreqTriggers = [];
    renderLowFreqList();
  });

  btnTriggerLowFreqSync?.addEventListener('click', () => {
    emitTo('overlay', 'request-low-freq-sync');
    if (btnTriggerLowFreqSync) {
      const orig = btnTriggerLowFreqSync.textContent;
      btnTriggerLowFreqSync.textContent = 'Armed!';
      setTimeout(() => {
        btnTriggerLowFreqSync.textContent = orig;
      }, 1000);
    }
  });

  syncLowFreqToOverlay();

  // --------------------------------------------------------------------------
  // 2. Timeline Event Capture (Console Logger) Manager
  // NOTE: Checkbox is strictly ALWAYS default unchecked (false), NEVER saved to storage.
  // --------------------------------------------------------------------------
  const timelineCaptureCheck = document.getElementById('timeline-capture-check') as HTMLInputElement | null;
  const timelineCaptureStatus = document.getElementById('timeline-capture-status');
  const timelineEventsCount = document.getElementById('timeline-events-count');
  const btnOpenTimelineMgr = document.getElementById('btn-open-timeline-mgr');
  const btnClearConsole = document.getElementById('btn-clear-console');
  const timelineMgrModal = document.getElementById('timeline-mgr-modal');
  const btnCloseTimelineMgr = document.getElementById('btn-close-timeline-mgr');
  const btnApplyTimeline = document.getElementById('btn-apply-timeline');
  const timelineRegexInput = document.getElementById('timeline-regex-input') as HTMLInputElement | null;
  const btnTimelineSelectFiltered = document.getElementById('btn-timeline-select-filtered');
  const btnTimelineCheckAll = document.getElementById('btn-timeline-check-all');
  const btnTimelineClearAll = document.getElementById('btn-timeline-clear-all');
  const timelineCheckboxContainer = document.getElementById('timeline-checkbox-container');
  const timelineSelectedSummary = document.getElementById('timeline-selected-summary');

  // Strict requirement: Always start false
  if (timelineCaptureCheck) {
    timelineCaptureCheck.checked = false;
  }

  let activeTimelineEvents: string[] = [...DEFAULT_TIMELINE_EVENTS];
  const savedTimelineEvents = localStorage.getItem('saved_timeline_events');
  if (savedTimelineEvents) {
    try {
      const parsed = JSON.parse(savedTimelineEvents);
      if (Array.isArray(parsed) && parsed.length > 0) {
        activeTimelineEvents = parsed;
      }
    } catch {
      // ignore
    }
  }

  function updateTimelineStatusSummary() {
    if (timelineEventsCount) timelineEventsCount.textContent = activeTimelineEvents.length.toString();
    if (timelineSelectedSummary) {
      timelineSelectedSummary.textContent = `Selected: ${activeTimelineEvents.length} / ${ALL_ROCKET_LEAGUE_EVENTS.length} events`;
    }
    if (timelineCaptureStatus) {
      const isEnabled = timelineCaptureCheck?.checked ?? false;
      if (isEnabled) {
        timelineCaptureStatus.textContent = `Status: Logging [${activeTimelineEvents.length} Events] to Console`;
        timelineCaptureStatus.style.color = 'var(--primer-success-fg)';
      } else {
        timelineCaptureStatus.textContent = `Status: Disabled (${activeTimelineEvents.length} Events Configured)`;
        timelineCaptureStatus.style.color = 'var(--primer-fg-muted)';
      }
    }
  }

  function renderTimelineEventsList() {
    if (!timelineCheckboxContainer) return;
    timelineCheckboxContainer.innerHTML = '';

    const query = timelineRegexInput?.value || '';

    ALL_ROCKET_LEAGUE_EVENTS.forEach((item) => {
      const isMatch = matchesRegexOrQuery(`${item.name} ${item.key} ${item.desc}`, query);
      if (!isMatch) return;

      const isChecked = activeTimelineEvents.includes(item.key);
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
          if (!activeTimelineEvents.includes(item.key)) activeTimelineEvents.push(item.key);
          label.classList.add('active');
        } else {
          activeTimelineEvents = activeTimelineEvents.filter((k) => k !== item.key);
          label.classList.remove('active');
        }
        updateTimelineStatusSummary();
      });

      timelineCheckboxContainer.appendChild(label);
    });

    updateTimelineStatusSummary();
  }

  function syncTimelineEventsToOverlay() {
    localStorage.setItem('saved_timeline_events', JSON.stringify(activeTimelineEvents));
    emitTo('overlay', 'set-timeline-capture-events', { events: activeTimelineEvents });
    if (timelineCaptureCheck) {
      emitTo('overlay', 'toggle-timeline-capture', {
        enabled: timelineCaptureCheck.checked,
        events: activeTimelineEvents
      });
    }
    updateTimelineStatusSummary();
  }

  timelineCaptureCheck?.addEventListener('change', () => {
    const isEnabled = timelineCaptureCheck.checked;
    emitTo('overlay', 'toggle-timeline-capture', {
      enabled: isEnabled,
      events: activeTimelineEvents
    });
    updateTimelineStatusSummary();
  });

  btnOpenTimelineMgr?.addEventListener('click', () => {
    if (timelineMgrModal) timelineMgrModal.style.display = 'flex';
    renderTimelineEventsList();
  });

  btnCloseTimelineMgr?.addEventListener('click', () => {
    if (timelineMgrModal) timelineMgrModal.style.display = 'none';
    syncTimelineEventsToOverlay();
  });

  btnApplyTimeline?.addEventListener('click', () => {
    if (timelineMgrModal) timelineMgrModal.style.display = 'none';
    syncTimelineEventsToOverlay();
  });

  timelineRegexInput?.addEventListener('input', renderTimelineEventsList);

  btnTimelineSelectFiltered?.addEventListener('click', () => {
    const query = timelineRegexInput?.value || '';
    const filteredKeys: string[] = [];
    ALL_ROCKET_LEAGUE_EVENTS.forEach((item) => {
      if (matchesRegexOrQuery(`${item.name} ${item.key} ${item.desc}`, query)) {
        filteredKeys.push(item.key);
      }
    });
    activeTimelineEvents = filteredKeys;
    renderTimelineEventsList();
  });

  btnTimelineCheckAll?.addEventListener('click', () => {
    activeTimelineEvents = ALL_ROCKET_LEAGUE_EVENTS.map((it) => it.key);
    renderTimelineEventsList();
  });

  btnTimelineClearAll?.addEventListener('click', () => {
    activeTimelineEvents = [];
    renderTimelineEventsList();
  });

  btnClearConsole?.addEventListener('click', () => {
    console.clear();
    if (btnClearConsole) {
      const orig = btnClearConsole.textContent;
      btnClearConsole.textContent = 'Cleared!';
      setTimeout(() => {
        btnClearConsole.textContent = orig;
      }, 1000);
    }
  });

  // Initial Sync (Always disabled initially)
  emitTo('overlay', 'toggle-timeline-capture', {
    enabled: false,
    events: activeTimelineEvents
  });
  updateTimelineStatusSummary();
}
