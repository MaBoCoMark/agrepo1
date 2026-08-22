import { listen, emitTo, emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getMergedManifest } from "../overlay/core/config-loader";
import {
  ComponentInstance,
  AnchorType,
  TargetPlayer,
  SpeedUnit,
  TextAlignment,
  GlobalLayoutSettings,
  ColorSource,
  DEFAULT_TEAM_COLORS
} from "../overlay/core/component-types";
import {
  COMPONENT_METAS,
  getAllComponentMetas,
  createComponentInnerHtml,
  updateComponentInstanceDom,
  initComponentCatalog
} from "../overlay/core/component-registry";
import {
  loadCompetitiveLayout,
  saveCompetitiveLayout,
  getDefaultCompetitiveLayout,
  createNewComponentInstance,
  isTextComponent,
  loadGlobalLayoutSettings,
  saveGlobalLayoutSettings
} from "../overlay/core/layout-store";
import { TelemetryBuffer } from "../overlay/core/component-types";
import { RL_EVENT_TYPES } from "../overlay/core/rl-events";

const manifest = getMergedManifest();

let currentWsStatus: "connected" | "connecting" | "disconnected" = "disconnected";
let activeScene = localStorage.getItem("saved_scene_mode") || "developer-dashboard";
let competitiveLayout: ComponentInstance[] = loadCompetitiveLayout();
let globalLayoutSettings: GlobalLayoutSettings = loadGlobalLayoutSettings();
let selectedCompId: string | null = null;
let isAutoSceneControlEnabled = true;
let selectedAnchor: AnchorType = "center";
let catalogSelectedCompId: string = "element-boost-text";
let activeCaptureEvents: string[] = ["UpdateState"];

async function setOverlayClickThrough(ignore: boolean): Promise<void> {
  try {
    await invoke("set_overlay_click_through", { ignore });
  } catch (err) {
    // fallback
  }
  try {
    await emit("toggle-overlay-click-through", { ignore });
  } catch (err) {
    // ignore
  }
}

// 🌟 GitHub Primer Theme Controller (Default: Light Mode)
function initThemeController() {
  const toggleBtn = document.getElementById("theme-toggle-btn");
  const themeIcon = document.getElementById("theme-icon");
  const themeLabel = document.getElementById("theme-label");

  const savedTheme = localStorage.getItem("app_theme") || "light";
  applyTheme(savedTheme);

  function applyTheme(theme: string) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("app_theme", theme);
    if (theme === "dark") {
      if (themeIcon) themeIcon.textContent = "🌙";
      if (themeLabel) themeLabel.textContent = "Dark Mode";
    } else {
      if (themeIcon) themeIcon.textContent = "☀️";
      if (themeLabel) themeLabel.textContent = "Light Mode";
    }
  }

  toggleBtn?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    applyTheme(next);
  });
}

async function initOverlayMonitor() {
  const resEl = document.getElementById("res-val");
  const scaleEl = document.getElementById("scale-val");
  if (resEl && scaleEl) {
    await listen<[number, number, number, number, number]>("overlay-metrics", (event) => {
      const [pWidth, pHeight, scale] = event.payload;
      resEl.textContent = pWidth + " x " + pHeight;
      scaleEl.textContent = (scale * 100).toFixed(0) + "%";
    });
  }
}

function initWebSocketControls() {
  const statusDot = document.getElementById("ws-status-dot");
  const statusText = document.getElementById("ws-status-text");
  const hostInput = document.getElementById("ws-host-input") as HTMLInputElement | null;
  const portInput = document.getElementById("ws-port-input") as HTMLInputElement | null;
  const toggleBtn = document.getElementById("ws-toggle-btn") as HTMLButtonElement | null;
  const disableRetryCheck = document.getElementById("ws-disable-retry-check") as HTMLInputElement | null;

  function updateStatusUI(status: "connected" | "connecting" | "disconnected") {
    currentWsStatus = status;
    if (!statusDot || !statusText || !hostInput || !portInput || !toggleBtn) return;

    statusDot.className = "status-dot " + status;

    if (status === "connected") {
      statusText.textContent = "Connected";
      statusText.style.color = "var(--primer-success-fg)";
      hostInput.disabled = true;
      portInput.disabled = true;
      toggleBtn.textContent = "Disconnect";
      toggleBtn.className = "btn btn-danger";
    } else if (status === "connecting") {
      statusText.textContent = "Connecting...";
      statusText.style.color = "var(--primer-warning-fg)";
      hostInput.disabled = true;
      portInput.disabled = true;
      toggleBtn.textContent = "Cancel Connection";
      toggleBtn.className = "btn btn-danger";
    } else {
      statusText.textContent = "Disconnected";
      statusText.style.color = "var(--primer-danger-fg)";
      hostInput.disabled = false;
      portInput.disabled = false;
      toggleBtn.textContent = "Connect";
      toggleBtn.className = "btn btn-primary";
    }
  }

  listen<{ status: "connected" | "connecting" | "disconnected"; host: string; port: string }>(
    "ws-status-changed",
    (event) => {
      updateStatusUI(event.payload.status);
      if (hostInput && !hostInput.disabled) hostInput.value = event.payload.host;
      if (portInput && !portInput.disabled) portInput.value = event.payload.port;
    }
  );

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (currentWsStatus === "connected" || currentWsStatus === "connecting") {
        emitTo("overlay", "ws-disconnect", {});
      } else {
        const host = hostInput?.value.trim() || "127.0.0.1";
        const port = portInput?.value.trim() || "52950";
        emitTo("overlay", "ws-set-config", { host, port });
        emitTo("overlay", "ws-connect", {});
      }
    });
  }

  hostInput?.addEventListener("change", () => {
    if (currentWsStatus === "disconnected") {
      emitTo("overlay", "ws-set-config", {
        host: hostInput.value.trim() || "127.0.0.1",
        port: portInput?.value.trim() || "52950"
      });
    }
  });

  portInput?.addEventListener("change", () => {
    if (currentWsStatus === "disconnected") {
      emitTo("overlay", "ws-set-config", {
        host: hostInput?.value.trim() || "127.0.0.1",
        port: portInput.value.trim() || "52950"
      });
    }
  });

  // 🌟 Disable Auto Retry Checkbox
  disableRetryCheck?.addEventListener("change", () => {
    emitTo("overlay", "toggle-ws-auto-retry", { disabled: disableRetryCheck.checked });
  });

  emitTo("overlay", "query-ws-status", {});
}

// 🌟 Packet Inspector with Multi-Event Filtering & Regex Selection
function initPacketInspector() {
  const captureBtn = document.getElementById("capture-packet-btn") as HTMLButtonElement | null;
  const copyBtn = document.getElementById("copy-packet-btn") as HTMLButtonElement | null;
  const statusLabel = document.getElementById("capture-status");
  const packetDisplay = document.getElementById("packet-display") as HTMLTextAreaElement | null;
  const btnOpenEvents = document.getElementById("btn-open-events-mgr");
  const activeCountBadge = document.getElementById("active-events-count");

  // Event Manager Modal elements
  const eventsModal = document.getElementById("events-mgr-modal");
  const btnCloseEvents = document.getElementById("btn-close-events-mgr");
  const btnApplyEvents = document.getElementById("btn-apply-events");
  const eventRegexInput = document.getElementById("event-regex-input") as HTMLInputElement | null;
  const eventsCheckboxContainer = document.getElementById("events-checkbox-container");
  const btnSelectAllFiltered = document.getElementById("btn-select-all-filtered");
  const btnCheckAllEvents = document.getElementById("btn-check-all-events");
  const btnClearAllEvents = document.getElementById("btn-clear-all-events");
  const eventsSelectedSummary = document.getElementById("events-selected-summary");

  function updateActiveEventsBadge() {
    if (activeCountBadge) activeCountBadge.textContent = activeCaptureEvents.length.toString();
    if (eventsSelectedSummary) {
      eventsSelectedSummary.textContent = "Selected: " + activeCaptureEvents.length + " / " + RL_EVENT_TYPES.length + " events";
    }
    if (statusLabel) {
      if (activeCaptureEvents.length === 0) {
        statusLabel.textContent = "Status: Idle (No events selected!)";
        statusLabel.style.color = "var(--primer-danger-fg)";
      } else if (activeCaptureEvents.length === 1) {
        statusLabel.textContent = "Status: Idle (Listening to " + activeCaptureEvents[0] + ")";
        statusLabel.style.color = "var(--primer-fg-muted)";
      } else {
        statusLabel.textContent = "Status: Idle (" + activeCaptureEvents.length + " Events Active)";
        statusLabel.style.color = "var(--primer-fg-muted)";
      }
    }
  }

  function renderEventsList() {
    if (!eventsCheckboxContainer) return;
    eventsCheckboxContainer.innerHTML = "";

    const query = eventRegexInput?.value.trim() || "";

    RL_EVENT_TYPES.forEach((evt) => {
      const isMatched = matchesRegexOrQuery(evt, query);
      const isChecked = activeCaptureEvents.includes(evt);

      const label = document.createElement("label");
      label.className = "event-item-label" + (isMatched ? "" : " filtered-out");
      label.setAttribute("data-event", evt);
      label.innerHTML = `
        <input type="checkbox" ${isChecked ? "checked" : ""} style="margin-right: 6px; cursor: pointer;">
        <span>${evt}</span>
      `;

      const check = label.querySelector("input") as HTMLInputElement;
      check.addEventListener("change", () => {
        if (check.checked) {
          if (!activeCaptureEvents.includes(evt)) activeCaptureEvents.push(evt);
        } else {
          activeCaptureEvents = activeCaptureEvents.filter((e) => e !== evt);
        }
        updateActiveEventsBadge();
        emitTo("overlay", "set-capture-target-events", { events: activeCaptureEvents });
      });

      eventsCheckboxContainer.appendChild(label);
    });

    updateActiveEventsBadge();
  }

  // 🌟 Select All Filtered: Selects all events matching regex query, and UNCHECKS all other non-matching events
  btnSelectAllFiltered?.addEventListener("click", () => {
    const query = eventRegexInput?.value.trim() || "";
    const matchedEvents = RL_EVENT_TYPES.filter((evt) => matchesRegexOrQuery(evt, query));
    activeCaptureEvents = [...matchedEvents];
    renderEventsList();
    emitTo("overlay", "set-capture-target-events", { events: activeCaptureEvents });
  });

  btnCheckAllEvents?.addEventListener("click", () => {
    activeCaptureEvents = [...RL_EVENT_TYPES];
    renderEventsList();
    emitTo("overlay", "set-capture-target-events", { events: activeCaptureEvents });
  });

  btnClearAllEvents?.addEventListener("click", () => {
    activeCaptureEvents = [];
    renderEventsList();
    emitTo("overlay", "set-capture-target-events", { events: activeCaptureEvents });
  });

  eventRegexInput?.addEventListener("input", renderEventsList);

  btnOpenEvents?.addEventListener("click", () => {
    if (eventsModal) {
      eventsModal.style.display = "flex";
      renderEventsList();
    }
  });

  btnCloseEvents?.addEventListener("click", () => {
    if (eventsModal) eventsModal.style.display = "none";
  });

  btnApplyEvents?.addEventListener("click", () => {
    if (eventsModal) eventsModal.style.display = "none";
  });

  if (captureBtn) {
    captureBtn.addEventListener("click", () => {
      if (activeCaptureEvents.length === 0) {
        alert("Please select at least one event in ⚙️ Events manager first.");
        return;
      }
      if (statusLabel) {
        const summary = activeCaptureEvents.length > 2
          ? activeCaptureEvents.slice(0, 2).join(", ") + " +" + (activeCaptureEvents.length - 2) + " more"
          : activeCaptureEvents.join(", ");
        statusLabel.textContent = "Status: Waiting for next [" + summary + "] packet...";
        statusLabel.style.color = "var(--primer-warning-fg)";
      }
      emitTo("overlay", "capture-next-packet", { events: activeCaptureEvents });
    });
  }

  listen<{ packet: string; event?: string }>("packet-captured", (event) => {
    if (packetDisplay) {
      packetDisplay.value = event.payload.packet;
    }
    if (statusLabel) {
      const evtName = event.payload.event || "Packet";
      statusLabel.textContent = "Status: Captured [" + evtName + "]!";
      statusLabel.style.color = "var(--primer-success-fg)";
      setTimeout(() => {
        updateActiveEventsBadge();
      }, 4000);
    }
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      if (packetDisplay && packetDisplay.value) {
        try {
          await navigator.clipboard.writeText(packetDisplay.value);
          const orig = copyBtn.textContent;
          copyBtn.textContent = "Copied!";
          setTimeout(() => {
            copyBtn.textContent = orig;
          }, 1500);
        } catch (err) {
          console.error("Failed to copy packet to clipboard", err);
        }
      }
    });
  }

  updateActiveEventsBadge();
}

function initCanvasBackgroundControls() {
  const modeTransparent = document.getElementById("bg-mode-transparent") as HTMLInputElement | null;
  const modeSolid = document.getElementById("bg-mode-solid") as HTMLInputElement | null;
  const customControls = document.getElementById("bg-custom-controls");
  const colorPicker = document.getElementById("bg-color-picker") as HTMLInputElement | null;
  const hexInput = document.getElementById("bg-hex-input") as HTMLInputElement | null;
  const opacitySlider = document.getElementById("bg-opacity-slider") as HTMLInputElement | null;
  const opacityLabel = document.getElementById("bg-opacity-label");
  const rgbaInput = document.getElementById("bg-rgba-input") as HTMLInputElement | null;

  function updateBg() {
    if (!modeTransparent || !modeSolid) return;

    if (modeTransparent.checked) {
      if (customControls) customControls.style.display = "none";
      emitTo("overlay", "change-overlay-bg", { color: "transparent", mode: "transparent" });
      return;
    }

    if (customControls) customControls.style.display = "flex";
    const hex = colorPicker?.value || "#0b0f19";
    const opacityPct = Number(opacitySlider?.value ?? 100);
    const alpha = opacityPct / 100;

    const rgb = hexToRgb(hex) || { r: 11, g: 15, b: 25 };
    const rgba = "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + Number(alpha.toFixed(2)) + ")";

    if (hexInput) hexInput.value = hex;
    if (opacityLabel) opacityLabel.textContent = opacityPct + "%";
    if (rgbaInput) rgbaInput.value = rgba;

    emitTo("overlay", "change-overlay-bg", { color: rgba, mode: "solid" });
  }

  modeTransparent?.addEventListener("change", updateBg);
  modeSolid?.addEventListener("change", updateBg);

  colorPicker?.addEventListener("input", () => {
    if (hexInput && colorPicker) hexInput.value = colorPicker.value;
    updateBg();
  });

  hexInput?.addEventListener("change", () => {
    if (!hexInput) return;
    let val = hexInput.value.trim();
    if (!val.startsWith("#")) val = "#" + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val) && colorPicker) {
      colorPicker.value = val;
    }
    updateBg();
  });

  opacitySlider?.addEventListener("input", updateBg);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function parseRgbaString(rgbaStr: string, fallbackHex: string = "#0969da", fallbackAlpha: number = 1.0) {
  if (!rgbaStr || typeof rgbaStr !== "string") {
    const rgb = hexToRgb(fallbackHex) || { r: 9, g: 105, b: 218 };
    return {
      hex: fallbackHex,
      alphaPct: Math.round(fallbackAlpha * 100),
      rgba: "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + fallbackAlpha + ")"
    };
  }

  if (rgbaStr.startsWith("#")) {
    const rgb = hexToRgb(rgbaStr) || { r: 9, g: 105, b: 218 };
    return {
      hex: rgbaStr,
      alphaPct: 100,
      rgba: "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", 1)"
    };
  }

  const match = rgbaStr.match(/rgba?\\s*\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)(?:\\s*,\\s*([\\d.]+))?\\s*\\)/);
  if (match) {
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const a = match[4] !== undefined ? parseFloat(match[4]) : 1.0;
    return {
      hex: rgbToHex(r, g, b),
      alphaPct: Math.round(a * 100),
      rgba: "rgba(" + r + ", " + g + ", " + b + ", " + Number(a.toFixed(2)) + ")"
    };
  }

  const rgb = hexToRgb(fallbackHex) || { r: 9, g: 105, b: 218 };
  return {
    hex: fallbackHex,
    alphaPct: Math.round(fallbackAlpha * 100),
    rgba: "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + fallbackAlpha + ")"
  };
}

function hexAndAlphaToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex) || { r: 9, g: 105, b: 218 };
  const a = Math.min(1, Math.max(0, alpha));
  return "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + Number(a.toFixed(2)) + ")";
}

function createRgbaInputControl(
  label: string,
  initialValue: string | undefined,
  fallbackHex: string,
  fallbackAlpha: number,
  onChange: (val: string) => void
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "4px";

  const parsed = parseRgbaString(initialValue || "", fallbackHex, fallbackAlpha);

  let currentHex = parsed.hex;
  let currentAlpha = parsed.alphaPct / 100;

  wrapper.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <span class="control-label">${label}:</span>
      <span class="rgba-alpha-label">${parsed.alphaPct}%</span>
    </div>
    <div class="rgba-control-row">
      <input type="color" class="rgba-color-input" value="${currentHex}">
      <input type="range" class="rgba-alpha-slider" min="0" max="100" value="${parsed.alphaPct}">
      <input type="text" class="input-field rgba-text-box" value="${parsed.rgba}">
    </div>
  `;

  const colorInput = wrapper.querySelector(".rgba-color-input") as HTMLInputElement;
  const alphaSlider = wrapper.querySelector(".rgba-alpha-slider") as HTMLInputElement;
  const alphaLabel = wrapper.querySelector(".rgba-alpha-label") as HTMLElement;
  const textInput = wrapper.querySelector(".rgba-text-box") as HTMLInputElement;

  function updateAll(newRgba: string, newHex: string, newAlphaPct: number) {
    colorInput.value = newHex;
    alphaSlider.value = newAlphaPct.toString();
    alphaLabel.textContent = newAlphaPct + "%";
    textInput.value = newRgba;
    onChange(newRgba);
  }

  colorInput.addEventListener("input", () => {
    currentHex = colorInput.value;
    const rgba = hexAndAlphaToRgba(currentHex, currentAlpha);
    updateAll(rgba, currentHex, Math.round(currentAlpha * 100));
  });

  alphaSlider.addEventListener("input", () => {
    const pct = Number(alphaSlider.value);
    currentAlpha = pct / 100;
    const rgba = hexAndAlphaToRgba(currentHex, currentAlpha);
    updateAll(rgba, currentHex, pct);
  });

  textInput.addEventListener("change", () => {
    const p = parseRgbaString(textInput.value.trim(), currentHex, currentAlpha);
    currentHex = p.hex;
    currentAlpha = p.alphaPct / 100;
    updateAll(p.rgba, currentHex, p.alphaPct);
  });

  return wrapper;
}

// 🌟 6 种颜色模式选择控件 (Default / Custom / My Primary / My Secondary / Opp Primary / Opp Secondary)
function createColorModeControl(
  label: string,
  currentMode: ColorSource = "default",
  customValue: string | undefined,
  fallbackHex: string = "#ffffff",
  fallbackAlpha: number = 1.0,
  onChange: (mode: ColorSource, customVal: string) => void
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "4px";
  wrapper.style.margin = "4px 0";

  let activeMode: ColorSource = currentMode || "default";
  let activeCustom = customValue || "";

  wrapper.innerHTML = `
    <div class="control-row" style="margin-bottom: 2px;">
      <span class="control-label">${label}:</span>
      <select class="select-field color-mode-select" style="padding: 2px 6px; font-size: 11px; flex: 1; min-width: 140px;">
        <option value="default" ${activeMode === "default" ? "selected" : ""}>Default (Follow Global / 默认全局)</option>
        <option value="custom" ${activeMode === "custom" ? "selected" : ""}>Custom (自定义颜色)</option>
        <option value="my-primary" ${activeMode === "my-primary" ? "selected" : ""}>My Primary (我方主色 - 浅黄)</option>
        <option value="my-secondary" ${activeMode === "my-secondary" ? "selected" : ""}>My Secondary (我方副色 - 深黄)</option>
        <option value="opp-primary" ${activeMode === "opp-primary" ? "selected" : ""}>Opponent Primary (对方主色 - 浅绿)</option>
        <option value="opp-secondary" ${activeMode === "opp-secondary" ? "selected" : ""}>Opponent Secondary (对方副色 - 深绿)</option>
      </select>
    </div>
    <div class="custom-color-container" style="display: ${activeMode === "custom" ? "block" : "none"}; margin-left: 8px;"></div>
  `;

  const modeSelect = wrapper.querySelector(".color-mode-select") as HTMLSelectElement;
  const customContainer = wrapper.querySelector(".custom-color-container") as HTMLElement;

  const rgbaControl = createRgbaInputControl(
    "Custom Color Value",
    activeCustom,
    fallbackHex,
    fallbackAlpha,
    (val) => {
      activeCustom = val;
      onChange(activeMode, activeCustom);
    }
  );
  customContainer.appendChild(rgbaControl);

  modeSelect.addEventListener("change", () => {
    activeMode = modeSelect.value as ColorSource;
    customContainer.style.display = activeMode === "custom" ? "block" : "none";
    onChange(activeMode, activeCustom);
  });

  return wrapper;
}

function createSliderControl(
  label: string,
  initialValue: number,
  min: number,
  max: number,
  unit: string,
  step: number = 1,
  onChange: (val: number) => void
): HTMLElement {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.flexDirection = "column";
  row.style.gap = "2px";
  const valId = "slider-val-" + Math.random().toString(36).substring(2, 8);
  row.innerHTML = `
    <div style="display: flex; justify-content: space-between;">
      <span class="control-label">${label}:</span>
      <span id="${valId}" style="color: var(--primer-accent-fg); font-size: 11px; font-weight: bold;">${initialValue}${unit}</span>
    </div>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${initialValue}" class="range-slider" style="cursor: pointer; width: 100%;">
  `;
  const slider = row.querySelector(".range-slider") as HTMLInputElement;
  const valLabel = row.querySelector("#" + valId) as HTMLElement;
  slider.addEventListener("input", () => {
    const v = Number(slider.value);
    valLabel.textContent = v + unit;
    onChange(v);
  });
  return row;
}

function createCheckboxControl(
  label: string,
  initialValue: boolean,
  color: string = "var(--primer-warning-fg)",
  onChange: (val: boolean) => void
): HTMLElement {
  const row = document.createElement("div");
  row.className = "control-row";
  row.innerHTML = `
    <label style="font-size: 11px; color: ${color}; cursor: pointer; font-weight: bold;">
      <input type="checkbox" ${initialValue ? "checked" : ""} style="cursor: pointer; margin-right: 4px;">
      ${label}
    </label>
  `;
  const check = row.querySelector("input") as HTMLInputElement;
  check.addEventListener("change", () => {
    onChange(check.checked);
  });
  return row;
}

function createTextInputControl(
  label: string,
  initialValue: string,
  onChange: (val: string) => void
): HTMLElement {
  const row = document.createElement("div");
  row.className = "control-row";
  row.innerHTML = `
    <span class="control-label">${label}:</span>
    <input type="text" class="input-field" value="${initialValue || ""}" style="width: 120px; padding: 2px 6px; font-size: 11px;">
  `;
  const input = row.querySelector("input") as HTMLInputElement;
  input.addEventListener("input", () => {
    onChange(input.value);
  });
  return row;
}


function createSelectControl(
  label: string,
  options: { label: string; value: string }[],
  selectedValue: string,
  onChange: (val: string) => void
): HTMLElement {
  const row = document.createElement("div");
  row.className = "control-row";
  row.style.margin = "4px 0";
  row.innerHTML = `
    <span class="control-label">${label}:</span>
    <select class="select-field" style="padding: 2px 6px; font-size: 11px; flex: 1;">
      ${options.map((opt) => `<option value="${opt.value}" ${opt.value === selectedValue ? "selected" : ""}>${opt.label}</option>`).join("")}
    </select>
  `;
  const sel = row.querySelector("select") as HTMLSelectElement;
  sel.addEventListener("change", () => onChange(sel.value));
  return row;
}

function matchesRegexOrQuery(target: string, query: string): boolean {
  if (!query) return true;
  try {
    const regex = new RegExp(query, "i");
    return regex.test(target);
  } catch {
    return target.toLowerCase().includes(query.toLowerCase());
  }
}

// 🌟 Competitive Layout Designer Section Controller
function initCompetitiveDesigner() {
  const editCheck = document.getElementById("layout-editing-check") as HTMLInputElement | null;
  const compList = document.getElementById("competitive-component-list");
  const tierSelect = document.getElementById("filter-tier-select") as HTMLSelectElement | null;
  const filterRegexInput = document.getElementById("component-filter-regex") as HTMLInputElement | null;
  const addSelect = document.getElementById("add-component-select") as HTMLSelectElement | null;
  const addBtn = document.getElementById("add-component-btn") as HTMLButtonElement | null;
  const collapseAllBtn = document.getElementById("collapse-all-btn");
  const deselectAllBtn = document.getElementById("deselect-all-btn");

  const targetPlayerSelect = document.getElementById("add-target-player-select") as HTMLSelectElement | null;
  const speedUnitSelect = document.getElementById("add-speed-unit-select") as HTMLSelectElement | null;
  const alignSelect = document.getElementById("add-align-select") as HTMLSelectElement | null;
  const followAspectCheck = document.getElementById("add-follow-aspect-check") as HTMLInputElement | null;

  const anchorBtns = document.querySelectorAll<HTMLButtonElement>(".anchor-grid-btn");
  anchorBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      anchorBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedAnchor = (btn.getAttribute("data-anchor") as AnchorType) || "center";
    });
  });

  // Global Settings Controls
  const globalControlsBox = document.getElementById("global-settings-controls");
  function renderGlobalSettingsUI() {
    if (!globalControlsBox) return;
    globalControlsBox.innerHTML = "";

    const saveGlobal = () => {
      saveGlobalLayoutSettings(globalLayoutSettings);
      emitTo("overlay", "update-global-settings", { settings: globalLayoutSettings });
    };

    // Global HUD Opacity
    const opacityCtrl = createSliderControl(
      "Global HUD Opacity",
      Math.round(globalLayoutSettings.opacity * 100),
      10,
      100,
      "%",
      5,
      (val) => {
        globalLayoutSettings.opacity = val / 100;
        saveGlobal();
      }
    );
    globalControlsBox.appendChild(opacityCtrl);

    // Global Text Color
    const textColorCtrl = createRgbaInputControl(
      "Global Text Color Override",
      globalLayoutSettings.textColor,
      "#ffffff",
      1.0,
      (val) => {
        globalLayoutSettings.textColor = val;
        saveGlobal();
      }
    );
    globalControlsBox.appendChild(textColorCtrl);

    // Global Outside Stroke Width
    const strokeWCtrl = createSliderControl(
      "Global Stroke Width",
      globalLayoutSettings.strokeWidth,
      0,
      15,
      "px",
      1,
      (val) => {
        globalLayoutSettings.strokeWidth = val;
        saveGlobal();
      }
    );
    globalControlsBox.appendChild(strokeWCtrl);

    // Global Outside Stroke Color
    const strokeColorCtrl = createRgbaInputControl(
      "Global Stroke Color",
      globalLayoutSettings.strokeColor,
      "#000000",
      1.0,
      (val) => {
        globalLayoutSettings.strokeColor = val;
        saveGlobal();
      }
    );
    globalControlsBox.appendChild(strokeColorCtrl);

    // Global Element Card Background Color
    const cardBgCtrl = createRgbaInputControl(
      "Global Card BG Color & Opacity",
      globalLayoutSettings.cardBgColor || globalLayoutSettings.bgColor,
      "#0a0e17",
      0.85,
      (val) => {
        globalLayoutSettings.cardBgColor = val;
        globalLayoutSettings.bgColor = val;
        saveGlobal();
      }
    );
    globalControlsBox.appendChild(cardBgCtrl);

    // Global Card Corner Radius
    const cardRadiusCtrl = createSliderControl(
      "Global Card Corner Radius",
      globalLayoutSettings.cardBorderRadius ?? globalLayoutSettings.bgRadius ?? 0,
      0,
      25,
      "px",
      1,
      (val) => {
        globalLayoutSettings.cardBorderRadius = val;
        globalLayoutSettings.bgRadius = val;
        saveGlobal();
      }
    );
    globalControlsBox.appendChild(cardRadiusCtrl);
  }

  renderGlobalSettingsUI();

  // Populate Add Component Dropdown based on tier filter and regex
  function updateComponentDropdown() {
    if (!addSelect) return;
    addSelect.innerHTML = "";

    const selectedTier = tierSelect?.value || "all";
    const query = filterRegexInput?.value.trim() || "";

    const allMetas = getAllComponentMetas();
    const filteredMetas = allMetas.filter((meta) => {
      const matchTier = selectedTier === "all" || meta.tier === selectedTier;
      const matchQuery = matchesRegexOrQuery(meta.displayName + " " + meta.id, query);
      return matchTier && matchQuery;
    });

    if (filteredMetas.length === 0) {
      addSelect.innerHTML = "<option value=\"\" disabled selected>No components matching filter</option>";
      if (addBtn) addBtn.disabled = true;
      return;
    }

    if (addBtn) addBtn.disabled = false;
    filteredMetas.forEach((meta) => {
      const opt = document.createElement("option");
      opt.value = meta.id;
      opt.textContent = `[${meta.tier.toUpperCase()}] ${meta.displayName}`;
      addSelect.appendChild(opt);
    });

    updateDynamicFieldVisibility();
  }

  function updateDynamicFieldVisibility() {
    if (!addSelect) return;
    const meta = COMPONENT_METAS[addSelect.value];
    if (!meta) return;

    if (targetPlayerSelect) {
      targetPlayerSelect.style.display = meta.category === "player" ? "block" : "none";
    }
    if (speedUnitSelect) {
      speedUnitSelect.style.display = meta.supportsSpeedUnit ? "block" : "none";
    }
    if (alignSelect) {
      alignSelect.style.display = meta.supportsAlignment ? "block" : "none";
    }
    if (followAspectCheck) {
      followAspectCheck.checked = true; // Lock aspect ratio checked by default
    }
  }

  tierSelect?.addEventListener("change", updateComponentDropdown);
  filterRegexInput?.addEventListener("input", updateComponentDropdown);
  addSelect?.addEventListener("change", updateDynamicFieldVisibility);
  updateComponentDropdown();

  // Allow Layout Adjustment checkbox toggle
  if (editCheck) {
    editCheck.addEventListener("change", () => {
      const isEnabled = editCheck.checked;
      emitTo("overlay", "toggle-layout-editing", { enabled: isEnabled });
      void setOverlayClickThrough(!isEnabled);
      if (!isEnabled) {
        selectComponent(null);
      }
    });
  }

  // Collapse All Advanced Drawers Button
  collapseAllBtn?.addEventListener("click", () => {
    if (!compList) return;
    compList.querySelectorAll(".advanced-drawer.open").forEach((drawer) => {
      drawer.classList.remove("open");
    });
    compList.querySelectorAll(".toggle-advanced-btn").forEach((btn) => {
      btn.classList.add("btn-secondary");
      btn.classList.remove("btn-primary");
    });
  });

  // Deselect All Components Button (hides 8-point draggers)
  deselectAllBtn?.addEventListener("click", () => {
    selectComponent(null);
  });

  // Add Component Button
  if (addBtn && addSelect) {
    addBtn.addEventListener("click", () => {
      const type = addSelect.value;
      const targetP = (targetPlayerSelect?.value as TargetPlayer) || "p1";
      const speedU = (speedUnitSelect?.value as SpeedUnit) || "kph";
      const align = (alignSelect?.value as TextAlignment) || "right";
      const followAspect = followAspectCheck?.checked ?? true;

      const newInst = createNewComponentInstance(type, targetP, speedU, align, followAspect, selectedAnchor);
      competitiveLayout.push(newInst);
      saveCompetitiveLayout(competitiveLayout);
      emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
      renderComponentList();
      selectComponent(newInst.instanceId);
    });
  }

  // Populate Specific Properties inside "⚙️ Advanced" drawer dynamically
  function renderComponentCustomPropsBox(inst: ComponentInstance, propsBox: HTMLElement) {
    inst.customProps = inst.customProps || {};
    propsBox.innerHTML = "";

    const saveAndEmit = () => {
      saveCompetitiveLayout(competitiveLayout);
      emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
    };

    const isCustomText = inst.componentType === "element-custom-text" || inst.componentType === "custom-text";
    const isStaticText = inst.componentType === "element-static-text";
    const isTextType = isTextComponent(inst.componentType);
    const isTeamColorBox = inst.componentType === "element-team-color-box";
    const isIndicator = (inst.componentType.includes("indicator") || inst.componentType.includes("status")) && !isTextType;
    const isBoostAlertBar = inst.componentType === "element-boost-alert-bar";
    const isBoostBar = (inst.componentType.includes("boost-bar") || inst.componentType.includes("boost-combo")) && !inst.componentType.includes("curved") && !isBoostAlertBar;
    const isBoostText = inst.componentType === "element-boost-text" || inst.componentType === "element-boost-text-fixed" || inst.componentType.includes("boost-val");
    const isSpeedBar = inst.componentType.includes("speed-bar") && !inst.componentType.includes("curved");
    const isCurvedBoost = inst.componentType === "element-curved-boost-bar";
    const isCurvedSpeed = inst.componentType === "element-curved-speedometer";

    // 🌟 When Follow Global is disabled, render rich per-component style override controls
    if (!inst.followGlobal) {
      const overrideHeader = document.createElement("div");
      overrideHeader.style.fontSize = "10px";
      overrideHeader.style.fontWeight = "bold";
      overrideHeader.style.color = "var(--primer-warning-fg)";
      overrideHeader.style.paddingBottom = "4px";
      overrideHeader.style.borderBottom = "1px dashed var(--primer-border-muted)";
      overrideHeader.textContent = "🎨 INDEPENDENT COMPONENT STYLE OVERRIDES:";
      propsBox.appendChild(overrideHeader);

      // 1. Component Opacity
      const compOpacityCtrl = createSliderControl(
        "Component Opacity",
        Math.round((inst.opacity !== undefined ? inst.opacity : 1.0) * 100),
        10,
        100,
        "%",
        5,
        (val) => {
          inst.opacity = val / 100;
          saveAndEmit();
        }
      );
      propsBox.appendChild(compOpacityCtrl);

      // 2. Component Text Color (6 color options or custom picker)
      if (isTextType || isCustomText || isStaticText) {
        const compTextColorCtrl = createColorModeControl(
          "Text Color Mode",
          inst.customProps?.textColorMode || "custom",
          inst.customProps?.textColor,
          "#ffffff",
          1.0,
          (mode, customVal) => {
            inst.customProps!.textColorMode = mode;
            inst.customProps!.textColor = customVal;
            saveAndEmit();
          }
        );
        propsBox.appendChild(compTextColorCtrl);

        // 3. Component Stroke Width & Stroke Color
        const compStrokeWCtrl = createSliderControl(
          "Custom Stroke Width",
          inst.customProps?.strokeWidth ?? 0,
          0,
          15,
          "px",
          1,
          (val) => {
            inst.customProps!.strokeWidth = val;
            saveAndEmit();
          }
        );
        propsBox.appendChild(compStrokeWCtrl);

        const compStrokeColorCtrl = createRgbaInputControl(
          "Custom Stroke Color",
          inst.customProps?.strokeColor,
          "#000000",
          1.0,
          (val) => {
            inst.customProps!.strokeColor = val;
            saveAndEmit();
          }
        );
        propsBox.appendChild(compStrokeColorCtrl);
      }

      // 4. Component Card Background (6 color options or custom) & Corner Radius
      const compBgCtrl = createColorModeControl(
        "Card BG Color Mode",
        inst.customProps?.bgColorMode || "custom",
        inst.customProps?.bgColor,
        "#0a0e17",
        0.85,
        (mode, customVal) => {
          inst.customProps!.bgColorMode = mode;
          inst.customProps!.bgColor = customVal;
          saveAndEmit();
        }
      );
      propsBox.appendChild(compBgCtrl);

      const compBgRadiusCtrl = createSliderControl(
        "Card Corner Radius",
        inst.customProps?.bgRadius ?? inst.customProps?.borderRadius ?? 0,
        0,
        25,
        "px",
        1,
        (val) => {
          inst.customProps!.bgRadius = val;
          inst.customProps!.borderRadius = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(compBgRadiusCtrl);
    }

    if (isStaticText) {
      const staticTxtCtrl = createTextInputControl(
        "Static Text Label",
        inst.customProps.staticText || "LABEL",
        (val) => {
          inst.customProps!.staticText = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(staticTxtCtrl);
    }

    if (isCustomText) {
      const customTxtCtrl = createTextInputControl(
        "Custom Text Content",
        inst.customProps.customText || "SUPERSONIC",
        (val) => {
          inst.customProps!.customText = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(customTxtCtrl);

      const boolVarCtrl = createSelectControl(
        "Condition Variable",
        [
          { label: "Supersonic (超音速)", value: "supersonic" },
          { label: "Boosting (加速喷射)", value: "boosting" },
          { label: "Has Car (在场存活)", value: "hascar" },
          { label: "On Ground (在地面)", value: "onground" },
          { label: "On Wall (在墙面)", value: "onwall" },
          { label: "Powersliding (漂移中)", value: "powersliding" },
          { label: "Demolished (被摧毁)", value: "demolished" },
          { label: "Overtime (加时赛)", value: "overtime" }
        ],
        inst.customProps.boolVar || "supersonic",
        (val) => {
          inst.customProps!.boolVar = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(boolVarCtrl);

      const invertCtrl = createCheckboxControl(
        "Invert Condition (Active when FALSE)",
        Boolean(inst.customProps.invertBool),
        "var(--primer-accent-fg)",
        (val) => {
          inst.customProps!.invertBool = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(invertCtrl);

      const enOpCtrl = createSliderControl(
        "Active Opacity",
        Math.round((inst.customProps.enabledOpacity ?? 1.0) * 100),
        0,
        100,
        "%",
        5,
        (val) => {
          inst.customProps!.enabledOpacity = val / 100;
          saveAndEmit();
        }
      );
      propsBox.appendChild(enOpCtrl);

      const disOpCtrl = createSliderControl(
        "Inactive Opacity",
        Math.round((inst.customProps.disabledOpacity ?? 0.2) * 100),
        0,
        100,
        "%",
        5,
        (val) => {
          inst.customProps!.disabledOpacity = val / 100;
          saveAndEmit();
        }
      );
      propsBox.appendChild(disOpCtrl);
    }

    if (isIndicator) {
      const activeColorCtrl = createColorModeControl(
        "Active Color Mode (ON)",
        inst.customProps.activeColorMode || "custom",
        inst.customProps.activeColor,
        "#388bfd",
        1.0,
        (mode, customVal) => {
          inst.customProps!.activeColorMode = mode;
          inst.customProps!.activeColor = customVal;
          saveAndEmit();
        }
      );
      propsBox.appendChild(activeColorCtrl);

      const inactiveColorCtrl = createRgbaInputControl(
        "Inactive Color (OFF)",
        inst.customProps.inactiveColor,
        "#334155",
        0.5,
        (val) => {
          inst.customProps!.inactiveColor = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(inactiveColorCtrl);

      const invertCtrl = createCheckboxControl(
        "Invert Condition (Active when FALSE)",
        Boolean(inst.customProps.invertBool),
        "var(--primer-accent-fg)",
        (val) => {
          inst.customProps!.invertBool = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(invertCtrl);
    }

    if (isBoostAlertBar) {
      const threshCtrl = createSliderControl(
        "Alert Boost Threshold (<=)",
        inst.customProps.threshold ?? 12,
        0,
        100,
        "%",
        1,
        (val) => {
          inst.customProps!.threshold = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(threshCtrl);

      const radiusCtrl = createSliderControl(
        "Corner Radius (Square / Circle)",
        inst.customProps.borderRadius ?? 4,
        0,
        100,
        "px",
        1,
        (val) => {
          inst.customProps!.borderRadius = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(radiusCtrl);

      const alertColorCtrl = createRgbaInputControl(
        "Alert / Glow Color",
        inst.customProps.alertColor || inst.customProps.basicColor,
        "#ef4444",
        1.0,
        (val) => {
          inst.customProps!.alertColor = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(alertColorCtrl);

      const borderWCtrl = createSliderControl(
        "Border Width",
        inst.customProps.borderWidth ?? 2,
        1,
        20,
        "px",
        1,
        (val) => {
          inst.customProps!.borderWidth = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(borderWCtrl);

      const blinkCtrl = createCheckboxControl(
        "Enable Glowing & Blinking Border",
        inst.customProps.enableBlink !== false,
        "var(--primer-danger-fg)",
        (val) => {
          inst.customProps!.enableBlink = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(blinkCtrl);
    }

    if (isBoostBar) {
      const bgCtrl = createRgbaInputControl(
        "Bar Background Color & Opacity",
        inst.customProps.bgColor,
        "#000000",
        0.65,
        (val) => {
          inst.customProps!.bgColor = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(bgCtrl);

      const radiusCtrl = createSliderControl(
        "Border Radius",
        inst.customProps.borderRadius ?? 4,
        0,
        25,
        "px",
        1,
        (val) => {
          inst.customProps!.borderRadius = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(radiusCtrl);
    }

    if (isBoostBar || isBoostText || isCurvedBoost) {
      const highColorCtrl = createRgbaInputControl(
        "High Boost Color (>50)",
        inst.customProps.colorHigh,
        "#10b981",
        1.0,
        (val) => {
          inst.customProps!.colorHigh = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(highColorCtrl);

      const midColorCtrl = createRgbaInputControl(
        "Mid Boost Color (20-50)",
        inst.customProps.colorMid,
        "#f59e0b",
        1.0,
        (val) => {
          inst.customProps!.colorMid = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(midColorCtrl);

      const lowColorCtrl = createRgbaInputControl(
        "Low Boost Color (<20)",
        inst.customProps.colorLow,
        "#ef4444",
        1.0,
        (val) => {
          inst.customProps!.colorLow = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(lowColorCtrl);

      const blinkCtrl = createCheckboxControl(
        "Enable Low Boost Danger Blink (<12)",
        inst.customProps.enableBlink !== false,
        "var(--primer-danger-fg)",
        (val) => {
          inst.customProps!.enableBlink = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(blinkCtrl);
    }

    if (isCurvedBoost || isCurvedSpeed) {
      const startDegCtrl = createSliderControl(
        "Orientation / Start Angle",
        inst.customProps.orientation ?? inst.customProps.startAngle ?? 90,
        0,
        360,
        "°",
        5,
        (val) => {
          inst.customProps!.orientation = val;
          inst.customProps!.startAngle = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(startDegCtrl);

      const gapCtrl = createSliderControl(
        "Gap Angle (Cutout)",
        inst.customProps.gap ?? (inst.customProps.sweepAngle ? 360 - inst.customProps.sweepAngle : 90),
        0,
        360,
        "°",
        5,
        (val) => {
          inst.customProps!.gap = val;
          inst.customProps!.sweepAngle = 360 - val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(gapCtrl);

      const thicknessCtrl = createSliderControl(
        "Arc Thickness",
        inst.customProps.thickness ?? inst.customProps.arcThickness ?? 8,
        2,
        40,
        "px",
        1,
        (val) => {
          inst.customProps!.thickness = val;
          inst.customProps!.arcThickness = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(thicknessCtrl);

      const trackColorCtrl = createRgbaInputControl(
        "Track / BG Ring Color",
        inst.customProps.trackColor,
        "rgba(255, 255, 255, 0.15)",
        0.15,
        (val) => {
          inst.customProps!.trackColor = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(trackColorCtrl);
    }

    if (isSpeedBar || isCurvedSpeed) {
      const supersonicColorCtrl = createRgbaInputControl(
        "Supersonic Color (>=80 / 2200)",
        inst.customProps.colorSupersonic || inst.customProps.colorHigh,
        "#9333ea",
        1.0,
        (val) => {
          inst.customProps!.colorSupersonic = val;
          inst.customProps!.colorHigh = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(supersonicColorCtrl);

      const maxStartColorCtrl = createRgbaInputControl(
        "Mid Speed Color (20-60 / 1400-2200)",
        inst.customProps.colorMidStart || inst.customProps.colorMid,
        "#77ca7a",
        1.0,
        (val) => {
          inst.customProps!.colorMidStart = val;
          inst.customProps!.colorMid = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(maxStartColorCtrl);

      const midColorCtrl = createRgbaInputControl(
        "Low Speed Color (<20 / <1400)",
        inst.customProps.colorLow,
        "#d4af37",
        1.0,
        (val) => {
          inst.customProps!.colorLow = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(midColorCtrl);
    }

    if (isSpeedBar) {
      const bgCtrl = createRgbaInputControl(
        "Bar Background Color & Opacity",
        inst.customProps.bgColor,
        "#000000",
        0.65,
        (val) => {
          inst.customProps!.bgColor = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(bgCtrl);

      const radiusCtrl = createSliderControl(
        "Border Radius",
        inst.customProps.borderRadius ?? 4,
        0,
        25,
        "px",
        1,
        (val) => {
          inst.customProps!.borderRadius = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(radiusCtrl);
    }

    if (isTeamColorBox) {
      const teamModeCtrl = createSelectControl(
        "Team Color Mode",
        [
          { label: "My Primary (我方主色)", value: "my-primary" },
          { label: "My Secondary (我方副色)", value: "my-secondary" },
          { label: "Opponent Primary (对方主色)", value: "opp-primary" },
          { label: "Opponent Secondary (对方副色)", value: "opp-secondary" },
          { label: "Custom (自定义)", value: "custom" }
        ],
        inst.customProps.boxColorMode || "my-primary",
        (val) => {
          inst.customProps!.boxColorMode = val as any;
          saveAndEmit();
        }
      );
      propsBox.appendChild(teamModeCtrl);

      const radiusCtrl = createSliderControl(
        "Border Radius",
        inst.customProps.borderRadius ?? 4,
        0,
        25,
        "px",
        1,
        (val) => {
          inst.customProps!.borderRadius = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(radiusCtrl);
    }
  }

  // Render Simplified Component List
  function renderComponentList() {
    if (!compList) return;
    compList.innerHTML = "";

    if (competitiveLayout.length === 0) {
      compList.innerHTML = "<div style=\"color: var(--primer-fg-muted); font-size: 11px; text-align: center; padding: 12px;\">No components added yet.</div>";
      return;
    }

    competitiveLayout.forEach((inst, index) => {
      inst.customProps = inst.customProps || {};
      if (inst.followGlobal === undefined) inst.followGlobal = true;
      if (inst.followAspectRatio === undefined) inst.followAspectRatio = true;

      const meta = COMPONENT_METAS[inst.componentType] || {
        id: inst.componentType,
        displayName: inst.name || inst.componentType,
        tier: inst.tier || "widget",
        category: inst.category,
        supportsSpeedUnit: false,
        supportsAlignment: false
      };

      const card = document.createElement("div");
      card.className = "comp-item-card " + (inst.instanceId === selectedCompId ? "selected" : "");
      card.setAttribute("data-id", inst.instanceId);

      const isPlayer = inst.category === "player";
      const isSpeed = meta.supportsSpeedUnit === true;
      const isAlign = meta.supportsAlignment === true;

      const tierBadge = meta.tier === "element"
        ? "<span class=\"comp-type-tag\" style=\"background: #8250df;\">ELEMENT</span>"
        : meta.tier === "panel"
        ? "<span class=\"comp-type-tag\" style=\"background: #0969da;\">PANEL</span>"
        : "<span class=\"comp-type-tag\" style=\"background: #1f883d;\">WIDGET</span>";

      const playerBadge = isPlayer
        ? "<span class=\"comp-type-tag\" style=\"background: #bc4c00;\">" + (inst.targetPlayer || "p1").toUpperCase() + "</span>"
        : "<span class=\"comp-type-tag\" style=\"background: #656d76;\">GLOBAL</span>";

      const isFirst = index === 0;
      const isLast = index === competitiveLayout.length - 1;

      card.innerHTML = `
        <div class="comp-card-header">
          <div class="comp-card-title">
            ${tierBadge}
            ${playerBadge}
            <span class="layer-badge" title="Layer Stacking Order">#${index + 1}</span>
            <span>${meta.displayName || inst.componentType}</span>
          </div>
          
          <div style="display: flex; align-items: center; gap: 4px;">
            <div class="layer-btn-group">
              <button class="layer-btn btn-top" title="Top" ${isLast ? "disabled" : ""}>⏫</button>
              <button class="layer-btn btn-up" title="Up" ${isLast ? "disabled" : ""}>🔼</button>
              <button class="layer-btn btn-down" title="Down" ${isFirst ? "disabled" : ""}>🔽</button>
              <button class="layer-btn btn-bottom" title="Bottom" ${isFirst ? "disabled" : ""}>⏬</button>
            </div>
            <button class="btn btn-secondary btn-sm toggle-advanced-btn" style="padding: 2px 6px; font-size: 10px;">⚙️ Advanced</button>
            <button class="btn btn-danger btn-sm delete-btn" style="padding: 1px 6px; font-size: 10px;" title="Delete">✕</button>
          </div>
        </div>

        <!-- Quick Player Selector if Player Component -->
        ${
          isPlayer
            ? `
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 6px;">
            <span class="control-label">Target Player:</span>
            <select class="select-field player-select" style="padding: 2px 4px; font-size: 10px; flex: 1;">
              <option value="p1" ${inst.targetPlayer === "p1" ? "selected" : ""}>P1 (Target)</option>
              <option value="p2" ${inst.targetPlayer === "p2" ? "selected" : ""}>P2 (Team 1)</option>
              <option value="p3" ${inst.targetPlayer === "p3" ? "selected" : ""}>P3 (Team 2)</option>
            </select>
          </div>
        `
            : ""
        }

        <!-- Advanced Collapsible Drawer -->
        <div class="advanced-drawer" id="advanced-drawer-${inst.instanceId}">
          <div class="control-row" style="margin-bottom: 6px;">
            <label style="font-size: 11px; color: var(--primer-accent-fg); cursor: pointer; font-weight: bold;">
              <input type="checkbox" class="follow-global-check" ${inst.followGlobal ? "checked" : ""} style="cursor: pointer; margin-right: 4px;">
              Follow Global Style
            </label>
          </div>

          <div class="control-row">
            <span class="control-label">Snap Anchor:</span>
            <select class="select-field anchor-select" style="padding: 2px 4px; font-size: 10px;">
              <option value="top-left" ${inst.anchor === "top-left" ? "selected" : ""}>Top-Left</option>
              <option value="top-center" ${inst.anchor === "top-center" ? "selected" : ""}>Top-Center</option>
              <option value="top-right" ${inst.anchor === "top-right" ? "selected" : ""}>Top-Right</option>
              <option value="center-left" ${inst.anchor === "center-left" ? "selected" : ""}>Center-Left</option>
              <option value="center" ${inst.anchor === "center" ? "selected" : ""}>Center</option>
              <option value="center-right" ${inst.anchor === "center-right" ? "selected" : ""}>Center-Right</option>
              <option value="bottom-left" ${inst.anchor === "bottom-left" ? "selected" : ""}>Bottom-Left</option>
              <option value="bottom-center" ${inst.anchor === "bottom-center" ? "selected" : ""}>Bottom-Center</option>
              <option value="bottom-right" ${inst.anchor === "bottom-right" ? "selected" : ""}>Bottom-Right</option>
            </select>
          </div>

          ${
            isSpeed
              ? `
            <div class="control-row">
              <span class="control-label">Speed Unit:</span>
              <select class="select-field speed-unit-select" style="padding: 2px 4px; font-size: 10px;">
                <option value="kph" ${inst.speedUnit !== "uu/s" ? "selected" : ""}>km/h</option>
                <option value="uu/s" ${inst.speedUnit === "uu/s" ? "selected" : ""}>uu/s</option>
              </select>
            </div>
          `
              : ""
          }

          ${
            isAlign
              ? `
            <div class="control-row">
              <span class="control-label">Alignment:</span>
              <select class="select-field align-select" style="padding: 2px 4px; font-size: 10px;">
                <option value="left" ${inst.textAlign === "left" ? "selected" : ""}>Left</option>
                <option value="center" ${inst.textAlign === "center" ? "selected" : ""}>Center</option>
                <option value="right" ${inst.textAlign === "right" || (!inst.textAlign && inst.componentType.includes("right")) ? "selected" : ""}>Right</option>
              </select>
            </div>
          `
              : ""
          }

          <div class="control-row">
            <label style="font-size: 11px; color: var(--primer-fg-default); cursor: pointer; font-weight: 600;">
              <input type="checkbox" class="aspect-check" ${inst.followAspectRatio ? "checked" : ""} style="cursor: pointer; margin-right: 4px;">
              Lock Aspect Ratio
            </label>
          </div>

          <!-- Custom Properties & Individual Overrides Box -->
          <div class="custom-props-box" id="props-box-${inst.instanceId}">
          </div>
        </div>
      `;

      // Toggle Advanced Drawer Button
      const advBtn = card.querySelector(".toggle-advanced-btn");
      const advDrawer = card.querySelector("#advanced-drawer-" + inst.instanceId) as HTMLElement;
      const propsBox = card.querySelector("#props-box-" + inst.instanceId) as HTMLElement;

      advBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        advDrawer.classList.toggle("open");
        advBtn.classList.toggle("btn-secondary");
        advBtn.classList.toggle("btn-primary");
      });

      // Render custom properties box
      if (propsBox) {
        renderComponentCustomPropsBox(inst, propsBox);
      }

      // Follow Global Checkbox
      const followGlobalCheck = card.querySelector(".follow-global-check") as HTMLInputElement | null;
      followGlobalCheck?.addEventListener("change", () => {
        inst.followGlobal = followGlobalCheck.checked;
        saveCompetitiveLayout(competitiveLayout);
        emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
        if (propsBox) {
          renderComponentCustomPropsBox(inst, propsBox);
        }
      });

      // Card selection
      card.addEventListener("click", (e) => {
        if (
          (e.target as HTMLElement).tagName === "SELECT" ||
          (e.target as HTMLElement).tagName === "BUTTON" ||
          (e.target as HTMLElement).tagName === "INPUT" ||
          (e.target as HTMLElement).closest(".advanced-drawer")
        ) return;
        selectComponent(inst.instanceId);
      });

      // Hover
      card.addEventListener("mouseenter", () => {
        emitTo("overlay", "hover-competitive-component", { instanceId: inst.instanceId });
      });
      card.addEventListener("mouseleave", () => {
        emitTo("overlay", "hover-competitive-component", { instanceId: null });
      });

      // Stacking reorder actions
      const btnTop = card.querySelector(".btn-top");
      const btnUp = card.querySelector(".btn-up");
      const btnDown = card.querySelector(".btn-down");
      const btnBottom = card.querySelector(".btn-bottom");
      const btnDelete = card.querySelector(".delete-btn");

      btnTop?.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = competitiveLayout.splice(index, 1)[0];
        competitiveLayout.push(item);
        saveCompetitiveLayout(competitiveLayout);
        emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
        renderComponentList();
      });

      btnUp?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (index < competitiveLayout.length - 1) {
          const item = competitiveLayout.splice(index, 1)[0];
          competitiveLayout.splice(index + 1, 0, item);
          saveCompetitiveLayout(competitiveLayout);
          emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
          renderComponentList();
        }
      });

      btnDown?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (index > 0) {
          const item = competitiveLayout.splice(index, 1)[0];
          competitiveLayout.splice(index - 1, 0, item);
          saveCompetitiveLayout(competitiveLayout);
          emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
          renderComponentList();
        }
      });

      btnBottom?.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = competitiveLayout.splice(index, 1)[0];
        competitiveLayout.unshift(item);
        saveCompetitiveLayout(competitiveLayout);
        emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
        renderComponentList();
      });

      btnDelete?.addEventListener("click", (e) => {
        e.stopPropagation();
        competitiveLayout.splice(index, 1);
        saveCompetitiveLayout(competitiveLayout);
        emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
        if (selectedCompId === inst.instanceId) selectedCompId = null;
        renderComponentList();
      });

      // Quick Player Select
      const playerSelect = card.querySelector(".player-select") as HTMLSelectElement | null;
      playerSelect?.addEventListener("change", () => {
        inst.targetPlayer = playerSelect.value as TargetPlayer;
        saveCompetitiveLayout(competitiveLayout);
        emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
        renderComponentList();
      });

      // Anchor Select
      const anchorSelect = card.querySelector(".anchor-select") as HTMLSelectElement | null;
      anchorSelect?.addEventListener("change", () => {
        inst.anchor = anchorSelect.value as AnchorType;
        saveCompetitiveLayout(competitiveLayout);
        emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
      });

      // Speed Unit Select
      const speedSelect = card.querySelector(".speed-unit-select") as HTMLSelectElement | null;
      speedSelect?.addEventListener("change", () => {
        inst.speedUnit = speedSelect.value as SpeedUnit;
        saveCompetitiveLayout(competitiveLayout);
        emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
      });

      // Alignment Select
      const alignSelectEl = card.querySelector(".align-select") as HTMLSelectElement | null;
      alignSelectEl?.addEventListener("change", () => {
        inst.textAlign = alignSelectEl.value as TextAlignment;
        saveCompetitiveLayout(competitiveLayout);
        emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
      });

      // Aspect Checkbox
      const aspectCheck = card.querySelector(".aspect-check") as HTMLInputElement | null;
      aspectCheck?.addEventListener("change", () => {
        inst.followAspectRatio = aspectCheck.checked;
        saveCompetitiveLayout(competitiveLayout);
        emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
      });

      compList.appendChild(card);
    });
  }

  function selectComponent(instanceId: string | null) {
    selectedCompId = instanceId;
    if (!compList) return;
    compList.querySelectorAll(".comp-item-card").forEach((card) => {
      if (instanceId && card.getAttribute("data-id") === instanceId) {
        card.classList.add("selected");
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        card.classList.remove("selected");
      }
    });
    emitTo("overlay", "select-competitive-component", { instanceId });
  }

  // Copy / Paste / Reset Layout Actions
  const copyBtn = document.getElementById("copy-layout-btn");
  const pasteBtn = document.getElementById("paste-layout-btn");
  const resetBtn = document.getElementById("reset-layout-btn");

  const importModal = document.getElementById("import-modal");
  const importJsonInput = document.getElementById("import-json-input") as HTMLTextAreaElement | null;
  const cancelImportBtn = document.getElementById("cancel-import-btn");
  const confirmImportBtn = document.getElementById("confirm-import-btn");

  copyBtn?.addEventListener("click", async () => {
    try {
      const jsonStr = JSON.stringify(competitiveLayout, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "✓ Copied!";
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 1500);
    } catch (err) {
      alert("Failed to copy configuration to clipboard.");
    }
  });

  pasteBtn?.addEventListener("click", () => {
    if (importModal && importJsonInput) {
      importJsonInput.value = "";
      importModal.style.display = "flex";
    }
  });

  cancelImportBtn?.addEventListener("click", () => {
    if (importModal) importModal.style.display = "none";
  });

  confirmImportBtn?.addEventListener("click", () => {
    if (!importJsonInput) return;
    try {
      const parsed = JSON.parse(importJsonInput.value.trim());
      if (Array.isArray(parsed)) {
        competitiveLayout = parsed;
        saveCompetitiveLayout(competitiveLayout);
        emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
        renderComponentList();
        if (importModal) importModal.style.display = "none";
      } else {
        alert("Invalid layout JSON format. Expected an array of component instances.");
      }
    } catch (e) {
      alert("Invalid JSON syntax.");
    }
  });

  resetBtn?.addEventListener("click", () => {
    if (confirm("Reset competitive layout to default preset? This will discard your custom layout.")) {
      competitiveLayout = getDefaultCompetitiveLayout();
      saveCompetitiveLayout(competitiveLayout);
      emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
      renderComponentList();
    }
  });

  // Listen for updates from Overlay (e.g. dragging or selecting on the overlay canvas)
  listen<{ layout: ComponentInstance[] }>("layout-updated-from-overlay", (event) => {
    competitiveLayout = event.payload.layout;
    saveCompetitiveLayout(competitiveLayout);
    renderComponentList();
  });

  listen<{ instanceId: string | null }>("component-selected-from-overlay", (event) => {
    selectedCompId = event.payload.instanceId;
    if (!compList) return;
    compList.querySelectorAll(".comp-item-card").forEach((card) => {
      if (card.getAttribute("data-id") === selectedCompId) {
        card.classList.add("selected");
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        card.classList.remove("selected");
      }
    });
  });

  // ==========================================
  // 🧩 3. Built-in Component Catalog & Live Previewer
  // ==========================================
  const btnOpenCatalog = document.getElementById("btn-open-catalog");
  const catalogModal = document.getElementById("catalog-modal");
  const btnCloseCatalog = document.getElementById("btn-close-catalog");
  const catalogSearchInput = document.getElementById("catalog-search-input") as HTMLInputElement | null;
  const catalogTierSelect = document.getElementById("catalog-tier-select") as HTMLSelectElement | null;
  const catalogItemList = document.getElementById("catalog-item-list");
  const catalogMount = document.getElementById("catalog-mount");
  const catalogPreviewTitle = document.getElementById("catalog-preview-title");
  const catalogInsertBtn = document.getElementById("catalog-insert-btn");

  const catalogSimBoost = document.getElementById("catalog-sim-boost") as HTMLInputElement | null;
  const catalogSimBoostVal = document.getElementById("catalog-sim-boost-val");
  const catalogSimSpeed = document.getElementById("catalog-sim-speed") as HTMLInputElement | null;
  const catalogSimSpeedVal = document.getElementById("catalog-sim-speed-val");

  let catalogTelemetry: TelemetryBuffer = {
    timeSeconds: 270,
    bOvertime: false,
    ballSpeed: 75,
    ballTeamNum: 0,
    myScore: 2,
    oppScore: 1,
    scoreDiff: 1,
    myPrimaryColor: DEFAULT_TEAM_COLORS.myPrimaryColor,
    mySecondaryColor: DEFAULT_TEAM_COLORS.mySecondaryColor,
    oppPrimaryColor: DEFAULT_TEAM_COLORS.oppPrimaryColor,
    oppSecondaryColor: DEFAULT_TEAM_COLORS.oppSecondaryColor,
    p1Name: "steamuser",
    p1Speed: 1600,
    p1Boost: 85,
    p1HasCar: true,
    p1Boosting: false,
    p1OnGround: true,
    p1OnWall: false,
    p1Powersliding: false,
    p1Demolished: false,
    p1Supersonic: false,
    p2Name: "Fury",
    p2Speed: 800,
    p2Boost: 50,
    p2HasCar: true,
    p2Boosting: false,
    p2OnGround: true,
    p2OnWall: false,
    p2Powersliding: false,
    p2Demolished: false,
    p2Supersonic: false,
    p3Name: "Khan",
    p3Speed: 400,
    p3Boost: 100,
    p3HasCar: true,
    p3Boosting: false,
    p3OnGround: true,
    p3OnWall: false,
    p3Powersliding: false,
    p3Demolished: false,
    p3Supersonic: false
  };

  const catalogPreviewWrapper = document.getElementById("catalog-preview-wrapper") as HTMLElement | null;
  const catalogDraggerFrame = document.getElementById("catalog-dragger-frame") as HTMLElement | null;

  function renderCatalogPreview() {
    if (!catalogMount || !catalogPreviewTitle) return;
    const meta = COMPONENT_METAS[catalogSelectedCompId];
    if (!meta) return;

    catalogPreviewTitle.textContent = "Previewing: " + meta.displayName + " (" + meta.id + ")";

    const dummyInst = createNewComponentInstance(
      meta.id,
      "p1",
      "kph",
      meta.supportsAlignment ? "center" : "right",
      true,
      "center"
    );

    const baseW = meta.baseWidthPx || 200;
    const baseH = meta.baseHeightPx || 60;

    let previewW = catalogPreviewWrapper?.clientWidth;
    let previewH = catalogPreviewWrapper?.clientHeight;
    if (!previewW || !previewH || previewW === 0) {
      previewW = Math.min(280, Math.max(60, baseW));
      previewH = Math.min(160, Math.max(30, baseH));
      if (catalogPreviewWrapper) {
        catalogPreviewWrapper.style.width = previewW + "px";
        catalogPreviewWrapper.style.height = previewH + "px";
      }
    }

    catalogMount.innerHTML = `
      <div class="comp-inner ${meta.isProportional ? "comp-proportional" : "comp-flexible"}">
        ${createComponentInnerHtml(dummyInst)}
      </div>
    `;

    if (meta.isProportional) {
      const inner = catalogMount.querySelector(".comp-proportional") as HTMLElement | null;
      if (inner) {
        const scale = Math.min(previewW / baseW, previewH / baseH);
        inner.style.width = baseW + "px";
        inner.style.height = baseH + "px";
        inner.style.transform = `scale(${scale.toFixed(4)})`;
        inner.style.transformOrigin = "center center";
      }
    }

    updateComponentInstanceDom(catalogMount, dummyInst, catalogTelemetry);
  }

  // 8-Point Dragger Resizer in Catalog Modal
  let isCatalogDragging = false;
  let catalogDragHandle: string | null = null;
  let catalogStartX = 0, catalogStartY = 0, catalogStartW = 200, catalogStartH = 60;

  catalogDraggerFrame?.addEventListener("pointerdown", (e) => {
    const target = (e.target as HTMLElement).closest(".dragger-handle");
    if (!target) return;
    const handle = target.getAttribute("data-handle");
    if (!handle) return;
    isCatalogDragging = true;
    catalogDragHandle = handle;
    catalogStartX = e.clientX;
    catalogStartY = e.clientY;
    catalogStartW = catalogPreviewWrapper?.clientWidth || 200;
    catalogStartH = catalogPreviewWrapper?.clientHeight || 60;
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener("pointermove", (e) => {
    if (!isCatalogDragging || !catalogDragHandle || !catalogPreviewWrapper) return;
    const dx = e.clientX - catalogStartX;
    const dy = e.clientY - catalogStartY;

    let newW = catalogStartW;
    let newH = catalogStartH;

    if (catalogDragHandle.includes("e")) newW = Math.max(40, catalogStartW + dx);
    if (catalogDragHandle.includes("w")) newW = Math.max(40, catalogStartW - dx);
    if (catalogDragHandle.includes("s")) newH = Math.max(20, catalogStartH + dy);
    if (catalogDragHandle.includes("n")) newH = Math.max(20, catalogStartH - dy);

    catalogPreviewWrapper.style.width = newW + "px";
    catalogPreviewWrapper.style.height = newH + "px";

    const meta = COMPONENT_METAS[catalogSelectedCompId];
    if (meta && meta.isProportional) {
      const inner = catalogMount?.querySelector(".comp-proportional") as HTMLElement | null;
      if (inner) {
        const baseW = meta.baseWidthPx || 160;
        const baseH = meta.baseHeightPx || 160;
        const scale = Math.min(newW / baseW, newH / baseH);
        inner.style.width = baseW + "px";
        inner.style.height = baseH + "px";
        inner.style.transform = `scale(${scale.toFixed(4)})`;
        inner.style.transformOrigin = "center center";
      }
    }
  });

  window.addEventListener("pointerup", () => {
    isCatalogDragging = false;
    catalogDragHandle = null;
  });

  function renderCatalogItemList() {
    if (!catalogItemList) return;
    catalogItemList.innerHTML = "";

    const query = catalogSearchInput?.value.trim() || "";
    const tier = catalogTierSelect?.value || "all";

    const all = getAllComponentMetas();
    const filtered = all.filter((m) => {
      const matchTier = tier === "all" || m.tier === tier;
      const matchQuery = matchesRegexOrQuery(m.displayName + " " + m.id, query);
      return matchTier && matchQuery;
    });

    filtered.forEach((meta) => {
      const itemCard = document.createElement("div");
      itemCard.className = "catalog-item-card " + (meta.id === catalogSelectedCompId ? "active" : "");
      itemCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
          <span style="font-weight: bold; color: var(--primer-fg-default); font-size: 11px;">${meta.displayName}</span>
          <span class="comp-type-tag" style="background: ${meta.tier === "element" ? "#8250df" : meta.tier === "panel" ? "#0969da" : "#1f883d"};">${meta.tier.toUpperCase()}</span>
        </div>
        <div style="font-size: 10px; color: var(--primer-fg-muted);">${meta.id}</div>
      `;

      itemCard.addEventListener("click", () => {
        catalogSelectedCompId = meta.id;
        catalogItemList.querySelectorAll(".catalog-item-card").forEach((c) => c.classList.remove("active"));
        itemCard.classList.add("active");
        if (catalogPreviewWrapper) {
          const baseW = meta.baseWidthPx || 200;
          const baseH = meta.baseHeightPx || 60;
          catalogPreviewWrapper.style.width = Math.min(280, Math.max(60, baseW)) + "px";
          catalogPreviewWrapper.style.height = Math.min(160, Math.max(30, baseH)) + "px";
        }
        renderCatalogPreview();
      });

      catalogItemList.appendChild(itemCard);
    });

    renderCatalogPreview();
  }

  btnOpenCatalog?.addEventListener("click", () => {
    if (catalogModal) {
      catalogModal.style.display = "flex";
      renderCatalogItemList();
    }
  });

  btnCloseCatalog?.addEventListener("click", () => {
    if (catalogModal) catalogModal.style.display = "none";
  });

  catalogSearchInput?.addEventListener("input", renderCatalogItemList);
  catalogTierSelect?.addEventListener("change", renderCatalogItemList);

  catalogSimBoost?.addEventListener("input", () => {
    const v = Number(catalogSimBoost.value);
    catalogTelemetry.p1Boost = v;
    if (catalogSimBoostVal) catalogSimBoostVal.textContent = v.toString();
    renderCatalogPreview();
  });

  catalogSimSpeed?.addEventListener("input", () => {
    const v = Number(catalogSimSpeed.value);
    catalogTelemetry.p1Speed = v;
    catalogTelemetry.p1Supersonic = v >= 2200;
    if (catalogSimSpeedVal) catalogSimSpeedVal.textContent = v.toString();
    renderCatalogPreview();
  });

  catalogInsertBtn?.addEventListener("click", () => {
    const meta = COMPONENT_METAS[catalogSelectedCompId];
    if (meta) {
      const newInst = createNewComponentInstance(meta.id, "p1", "kph", "right", true, selectedAnchor);
      competitiveLayout.push(newInst);
      saveCompetitiveLayout(competitiveLayout);
      emitTo("overlay", "update-competitive-layout", { layout: competitiveLayout });
      renderComponentList();
      selectComponent(newInst.instanceId);
      if (catalogModal) catalogModal.style.display = "none";
    }
  });

  renderComponentList();
}

function renderAndBindControls() {
  const autoHideCheck = document.getElementById("auto-hide-non-existing-check") as HTMLInputElement | null;
  if (autoHideCheck) {
    autoHideCheck.checked = globalLayoutSettings.autoHideNonExistingPlayers !== false;
    autoHideCheck.addEventListener("change", () => {
      globalLayoutSettings.autoHideNonExistingPlayers = autoHideCheck.checked;
      saveGlobalLayoutSettings(globalLayoutSettings);
      emitTo("overlay", "update-global-settings", { settings: globalLayoutSettings });
    });
  }

  const autoSceneCheck = document.getElementById("auto-scene-control-check") as HTMLInputElement | null;
  const refContainer = document.getElementById("ref-container");
  const sceneContainer = document.getElementById("scene-container");
  const compSection = document.getElementById("competitive-designer-section");
  const compDivider = document.getElementById("comp-divider");
  const devTuningSection = document.getElementById("dev-dashboard-tuning-section");
  const replayTuningSection = document.getElementById("replay-tuning-section");

  const savedRef = "empty";

  function updateSceneVisibility(sceneId: string) {
    activeScene = sceneId;
    localStorage.setItem("saved_scene_mode", sceneId);

    if (sceneId === "competitive") {
      if (compSection) compSection.style.display = "block";
      if (compDivider) compDivider.style.display = "block";
      if (devTuningSection) devTuningSection.style.display = "none";
      if (replayTuningSection) replayTuningSection.style.display = "none";
    } else if (sceneId === "developer-dashboard") {
      if (compSection) compSection.style.display = "none";
      if (compDivider) compDivider.style.display = "none";
      if (devTuningSection) devTuningSection.style.display = "block";
      if (replayTuningSection) replayTuningSection.style.display = "none";
    } else if (sceneId === "replay-viewer") {
      if (compSection) compSection.style.display = "none";
      if (compDivider) compDivider.style.display = "none";
      if (devTuningSection) devTuningSection.style.display = "none";
      if (replayTuningSection) replayTuningSection.style.display = "block";
    } else {
      if (compSection) compSection.style.display = "none";
      if (compDivider) compDivider.style.display = "none";
      if (devTuningSection) devTuningSection.style.display = "none";
      if (replayTuningSection) replayTuningSection.style.display = "none";
    }

    if (sceneId !== "competitive") {
      const editCheck = document.getElementById("layout-editing-check") as HTMLInputElement | null;
      if (editCheck && editCheck.checked) {
        editCheck.checked = false;
        emitTo("overlay", "toggle-layout-editing", { enabled: false });
        void setOverlayClickThrough(true);
        emitTo("overlay", "select-competitive-component", { instanceId: null });
      }
    }
  }

  function updateSceneRadiosDisabledState(autoControl: boolean) {
    if (!sceneContainer) return;
    const inputs = sceneContainer.querySelectorAll<HTMLInputElement>("input[type=\"radio\"]");
    inputs.forEach((input) => {
      input.disabled = autoControl;
      const label = input.parentElement;
      if (label) {
        label.style.opacity = autoControl ? "0.5" : "1";
        label.style.cursor = autoControl ? "not-allowed" : "pointer";
      }
    });
  }

  function updateActiveSceneRadio(sceneId: string) {
    if (!sceneContainer) return;
    const targetInput = sceneContainer.querySelector<HTMLInputElement>(`input[value="${sceneId}"]`);
    if (targetInput) {
      targetInput.checked = true;
    }
  }

  // Automatic Scene Control Checkbox
  if (autoSceneCheck) {
    isAutoSceneControlEnabled = autoSceneCheck.checked;
    autoSceneCheck.addEventListener("change", () => {
      isAutoSceneControlEnabled = autoSceneCheck.checked;
      updateSceneRadiosDisabledState(isAutoSceneControlEnabled);
      emitTo("overlay", "toggle-auto-scene-control", { enabled: isAutoSceneControlEnabled });
    });
  }

  // 1. References Group
  if (refContainer) {
    manifest.references.forEach((item: any) => {
      const label = document.createElement("label");
      label.style.display = "block";
      label.style.cursor = "pointer";
      label.style.margin = "3px 0";
      label.innerHTML = `<input type="radio" name="ref-group" value="${item.id}" ${item.id === savedRef ? "checked" : ""} style="margin-right: 6px;"> ${item.name}`;
      refContainer.appendChild(label);
      label.querySelector("input")?.addEventListener("change", () => {
        emitTo("overlay", "change-ref-layer", { mode: item.id });
      });
    });
  }

  // 2. Scenes Group
  if (sceneContainer) {
    manifest.scenes.forEach((item: any) => {
      const label = document.createElement("label");
      label.style.display = "block";
      label.style.cursor = "pointer";
      label.style.margin = "3px 0";
      label.innerHTML = `<input type="radio" name="scene-group" value="${item.id}" ${item.id === activeScene ? "checked" : ""} style="margin-right: 6px;"> ${item.name}`;
      sceneContainer.appendChild(label);
      label.querySelector("input")?.addEventListener("change", () => {
        updateSceneVisibility(item.id);
        emitTo("overlay", "change-scene-layer", { scene: item.id });
      });
    });
  }

  updateSceneVisibility(activeScene);
  updateSceneRadiosDisabledState(isAutoSceneControlEnabled);

  // Listen for scene auto switch from overlay
  listen<{ scene: string }>("scene-auto-switched", (event) => {
    const sId = event.payload.scene;
    updateActiveSceneRadio(sId);
    updateSceneVisibility(sId);
  });

  // 3. Opacity scroll
  const opacityZone = document.getElementById("opacity-zone");
  const opacityVal = document.getElementById("opacity-val");
  let opacity = 100;
  if (opacityZone && opacityVal) {
    opacityZone.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) opacity = Math.min(100, opacity + 5);
      else opacity = Math.max(0, opacity - 5);
      opacityVal.textContent = opacity.toString();
      emitTo("overlay", "change-ref-opacity", { opacity: opacity / 100 });
    });
  }

  // 4. Mock Simulation Checkbox
  const mockCheckbox = document.getElementById("mock-simulation-check") as HTMLInputElement | null;
  if (mockCheckbox) {
    mockCheckbox.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      emitTo("overlay", "toggle-mock-simulation", { enabled: target.checked });
    });
  }

  // 5. Developer Dashboard Font Scale
  const fontZone = document.getElementById("font-size-zone");
  const fontVal = document.getElementById("font-size-val");
  let currentFontScale = 2.0;
  if (fontVal) fontVal.textContent = currentFontScale.toFixed(1);

  if (fontZone && fontVal) {
    fontZone.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        currentFontScale = parseFloat((currentFontScale + 0.1).toFixed(1));
      } else {
        currentFontScale = Math.max(0.5, parseFloat((currentFontScale - 0.1).toFixed(1)));
      }
      fontVal.textContent = currentFontScale.toFixed(1);
      emitTo("overlay", "change-font-scale", { size: currentFontScale });
    });
  }

  // 6. Developer Dashboard Bar Width
  const barWidthZone = document.getElementById("bar-width-zone");
  const barWidthVal = document.getElementById("bar-width-val");
  let currentBarWidth = 12.0;
  let currentBarHeight = 1.0;
  if (barWidthVal) barWidthVal.textContent = currentBarWidth.toFixed(1);

  if (barWidthZone && barWidthVal) {
    barWidthZone.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) currentBarWidth = parseFloat((currentBarWidth + 0.1).toFixed(1));
      else currentBarWidth = Math.max(1.0, parseFloat((currentBarWidth - 0.1).toFixed(1)));
      barWidthVal.textContent = currentBarWidth.toFixed(1);
      emitTo("overlay", "change-bar-dimensions", { width: currentBarWidth, height: currentBarHeight });
    });
  }

  // 7. Developer Dashboard Bar Height
  const barHeightZone = document.getElementById("bar-height-zone");
  const barHeightVal = document.getElementById("bar-height-val");
  if (barHeightVal) barHeightVal.textContent = currentBarHeight.toFixed(1);

  if (barHeightZone && barHeightVal) {
    barHeightZone.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) currentBarHeight = parseFloat((currentBarHeight + 0.1).toFixed(1));
      else currentBarHeight = Math.max(0.1, parseFloat((currentBarHeight - 0.1).toFixed(1)));
      barHeightVal.textContent = currentBarHeight.toFixed(1);
      emitTo("overlay", "change-bar-dimensions", { width: currentBarWidth, height: currentBarHeight });
    });
  }

  // 8. Blink Duration
  const blinkZone = document.getElementById("blink-freq-zone");
  const blinkVal = document.getElementById("blink-freq-val");
  let currentBlinkDuration = 0.5;
  if (blinkVal) blinkVal.textContent = currentBlinkDuration.toFixed(2);

  if (blinkZone && blinkVal) {
    blinkZone.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        currentBlinkDuration = Math.min(3.0, parseFloat((currentBlinkDuration + 0.05).toFixed(2)));
      } else {
        currentBlinkDuration = Math.max(0.1, parseFloat((currentBlinkDuration - 0.05).toFixed(2)));
      }
      blinkVal.textContent = currentBlinkDuration.toFixed(2);
      emitTo("overlay", "change-blink-freq", { duration: currentBlinkDuration });
    });
  }

  // 9. Replay Viewer Tuning & Test Controls
  const replayTransZone = document.getElementById("replay-transition-zone");
  const replayTransVal = document.getElementById("replay-transition-val");
  let currentReplayDuration = 0.75;
  if (replayTransVal) replayTransVal.textContent = currentReplayDuration.toFixed(2);

  if (replayTransZone && replayTransVal) {
    replayTransZone.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        currentReplayDuration = Math.min(3.0, parseFloat((currentReplayDuration + 0.05).toFixed(2)));
      } else {
        currentReplayDuration = Math.max(0.1, parseFloat((currentReplayDuration - 0.05).toFixed(2)));
      }
      replayTransVal.textContent = currentReplayDuration.toFixed(2);
      emitTo("overlay", "change-replay-transition-time", { duration: currentReplayDuration });
    });
  }

  const btnToggleReplayFooter = document.getElementById("btn-toggle-replay-footer");
  if (btnToggleReplayFooter) {
    btnToggleReplayFooter.addEventListener("click", () => {
      emitTo("overlay", "toggle-replay-footer", {});
    });
  }

  const btnTestReplayLifecycle = document.getElementById("btn-test-replay-lifecycle");
  if (btnTestReplayLifecycle) {
    btnTestReplayLifecycle.addEventListener("click", () => {
      emitTo("overlay", "simulate-replay-lifecycle", {});
    });
  }

  // Window unload cleanup to re-enable overlay click-through
  window.addEventListener("beforeunload", () => {
    const editCheck = document.getElementById("layout-editing-check") as HTMLInputElement | null;
    if (editCheck?.checked) {
      emitTo("overlay", "toggle-layout-editing", { enabled: false });
      void setOverlayClickThrough(true);
    }
  });
}

async function bootstrap() {
  initComponentCatalog();
  initThemeController();
  await initOverlayMonitor();
  initWebSocketControls();
  initPacketInspector();
  initCanvasBackgroundControls();
  renderAndBindControls();
  initCompetitiveDesigner();
}

bootstrap();
