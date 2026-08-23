import { ColorSource, COLOR_SOURCE_OPTIONS } from '../../overlay/core/team-colors';

/**
 * ============================================================================
 * 🎨 UI Controls & Form Builders for Configurator Panel
 * ============================================================================
 */

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (hex.length !== 6) return null;
  const num = parseInt(hex, 16);
  if (isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function parseRgbaString(
  rgbaStr: string,
  fallbackHex: string = '#0969da',
  fallbackAlpha: number = 1.0
): { hex: string; alpha: number } {
  if (!rgbaStr || rgbaStr.trim() === '' || rgbaStr === 'transparent') {
    return { hex: fallbackHex, alpha: rgbaStr === 'transparent' ? 0 : fallbackAlpha };
  }
  const clean = rgbaStr.trim().toLowerCase();
  if (clean.startsWith('#')) {
    if (clean.length === 9) {
      const hex = clean.substring(0, 7);
      const alphaHex = clean.substring(7, 9);
      const alpha = parseInt(alphaHex, 16) / 255;
      return { hex, alpha: Math.round(alpha * 100) / 100 };
    }
    return { hex: clean.substring(0, 7), alpha: 1.0 };
  }
  const match = clean.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (match) {
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const a = match[4] !== undefined ? parseFloat(match[4]) : 1.0;
    return {
      hex: rgbToHex(r, g, b),
      alpha: Math.min(1.0, Math.max(0.0, a))
    };
  }
  return { hex: fallbackHex, alpha: fallbackAlpha };
}

export function hexAndAlphaToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex) || { r: 9, g: 105, b: 218 };
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha.toFixed(2)})`;
}

export function createRgbaInputControl(
  label: string,
  currentValue: string,
  defaultHex: string,
  defaultAlpha: number,
  onChange: (val: string) => void
): HTMLElement {
  const parsed = parseRgbaString(currentValue, defaultHex, defaultAlpha);
  const container = document.createElement('div');
  container.className = 'ctrl-group';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'stretch';
  container.style.gap = '4px';

  const labelRow = document.createElement('div');
  labelRow.style.display = 'flex';
  labelRow.style.justifyContent = 'space-between';
  labelRow.style.alignItems = 'center';

  const lbl = document.createElement('span');
  lbl.className = 'ctrl-label';
  lbl.textContent = label;

  const hexValText = document.createElement('span');
  hexValText.style.fontFamily = 'monospace';
  hexValText.style.fontSize = '10px';
  hexValText.style.color = 'var(--primer-fg-muted)';
  hexValText.textContent = `${parsed.hex} (${Math.round(parsed.alpha * 100)}%)`;

  labelRow.appendChild(lbl);
  labelRow.appendChild(hexValText);
  container.appendChild(labelRow);

  const inputsRow = document.createElement('div');
  inputsRow.style.display = 'flex';
  inputsRow.style.alignItems = 'center';
  inputsRow.style.gap = '8px';

  const colorPicker = document.createElement('input');
  colorPicker.type = 'color';
  colorPicker.className = 'input-color';
  colorPicker.value = parsed.hex;
  colorPicker.style.width = '32px';
  colorPicker.style.height = '24px';
  colorPicker.style.flexShrink = '0';

  const alphaSlider = document.createElement('input');
  alphaSlider.type = 'range';
  alphaSlider.className = 'slider';
  alphaSlider.min = '0';
  alphaSlider.max = '100';
  alphaSlider.value = Math.round(parsed.alpha * 100).toString();
  alphaSlider.style.flex = '1';

  inputsRow.appendChild(colorPicker);
  inputsRow.appendChild(alphaSlider);
  container.appendChild(inputsRow);

  const update = () => {
    const hex = colorPicker.value;
    const a = parseInt(alphaSlider.value, 10) / 100;
    hexValText.textContent = `${hex} (${alphaSlider.value}%)`;
    onChange(hexAndAlphaToRgba(hex, a));
  };

  colorPicker.addEventListener('input', update);
  alphaSlider.addEventListener('input', update);

  return container;
}

export function createColorModeControl(
  label: string,
  currentMode: ColorSource | undefined,
  currentColor: string | undefined,
  defaultColor: string,
  onChange: (mode: ColorSource, customColor: string) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'ctrl-group';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'stretch';
  container.style.gap = '4px';

  const labelRow = document.createElement('div');
  labelRow.style.display = 'flex';
  labelRow.style.justifyContent = 'space-between';
  labelRow.style.alignItems = 'center';

  const lbl = document.createElement('span');
  lbl.className = 'ctrl-label';
  lbl.textContent = label;
  labelRow.appendChild(lbl);
  container.appendChild(labelRow);

  const selectRow = document.createElement('div');
  selectRow.style.display = 'flex';
  selectRow.style.alignItems = 'center';
  selectRow.style.gap = '6px';

  const select = document.createElement('select');
  select.className = 'select-control';
  select.style.flex = '1';

  COLOR_SOURCE_OPTIONS.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if ((currentMode || 'default') === opt.value) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'input-color';
  colorInput.value = currentColor || defaultColor;
  colorInput.style.width = '30px';
  colorInput.style.height = '24px';
  colorInput.style.display = (currentMode === 'custom' || currentMode === undefined) ? 'inline-block' : 'none';

  selectRow.appendChild(select);
  selectRow.appendChild(colorInput);
  container.appendChild(selectRow);

  select.addEventListener('change', () => {
    const newMode = select.value as ColorSource;
    colorInput.style.display = (newMode === 'custom' || newMode === 'default') ? 'inline-block' : 'none';
    onChange(newMode, colorInput.value);
  });

  colorInput.addEventListener('input', () => {
    onChange(select.value as ColorSource, colorInput.value);
  });

  return container;
}

export function createSliderControl(
  label: string,
  min: number,
  max: number,
  step: number,
  val: number,
  unit: string,
  onChange: (v: number) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'ctrl-group';

  const lbl = document.createElement('span');
  lbl.className = 'ctrl-label';
  lbl.textContent = label;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'slider';
  slider.min = min.toString();
  slider.max = max.toString();
  slider.step = step.toString();
  slider.value = val.toString();

  const valDisplay = document.createElement('span');
  valDisplay.className = 'ctrl-val';
  valDisplay.textContent = `${val}${unit}`;

  slider.addEventListener('input', () => {
    const num = parseFloat(slider.value);
    valDisplay.textContent = `${num}${unit}`;
    onChange(num);
  });

  container.appendChild(lbl);
  container.appendChild(slider);
  container.appendChild(valDisplay);
  return container;
}

export function createCheckboxControl(
  label: string,
  checked: boolean,
  onChange: (chk: boolean) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'ctrl-group';

  const lbl = document.createElement('span');
  lbl.className = 'ctrl-label';
  lbl.textContent = label;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  checkbox.style.cursor = 'pointer';

  checkbox.addEventListener('change', () => {
    onChange(checkbox.checked);
  });

  container.appendChild(lbl);
  container.appendChild(checkbox);
  return container;
}

export function createTextInputControl(
  label: string,
  value: string,
  placeholder: string,
  onChange: (val: string) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'ctrl-group';

  const lbl = document.createElement('span');
  lbl.className = 'ctrl-label';
  lbl.textContent = label;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input-field';
  input.value = value;
  input.placeholder = placeholder;
  input.style.flex = '1';
  input.spellcheck = false;
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocomplete', 'off');

  input.addEventListener('input', () => {
    onChange(input.value);
  });

  container.appendChild(lbl);
  container.appendChild(input);
  return container;
}

export function createSelectControl(
  label: string,
  options: { label: string; value: string }[],
  selectedValue: string,
  onChange: (val: string) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'ctrl-group';

  const lbl = document.createElement('span');
  lbl.className = 'ctrl-label';
  lbl.textContent = label;

  const select = document.createElement('select');
  select.className = 'select-control';
  select.style.flex = '1';

  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === selectedValue) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  select.addEventListener('change', () => {
    onChange(select.value);
  });

  container.appendChild(lbl);
  container.appendChild(select);
  return container;
}

export function matchesRegexOrQuery(target: string, query: string): boolean {
  if (!query || query.trim() === '') return true;
  const clean = query.trim();
  try {
    const regex = new RegExp(clean, 'i');
    return regex.test(target);
  } catch {
    return target.toLowerCase().includes(clean.toLowerCase());
  }
}
