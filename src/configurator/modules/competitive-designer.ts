function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

import { emitTo, listen } from '@tauri-apps/api/event';
import {
  ComponentInstance,
  AnchorType,
  TargetPlayer,
  SpeedUnit,
  TextAlignment,
  GlobalLayoutSettings,
  ColorSource
} from '../../overlay/core/component-types';
import {
  COMPONENT_METAS,
  getAllComponentMetas
} from '../../overlay/core/component-registry';
import {
  loadCompetitiveLayout,
  saveCompetitiveLayout,
  getDefaultCompetitiveLayout,
  createNewComponentInstance,
  isTextComponent,
  loadGlobalLayoutSettings,
  saveGlobalLayoutSettings
} from '../../overlay/core/layout-store';
import { setOverlayClickThrough } from '../../overlay/core/telemetry-state';
import {
  matchesRegexOrQuery,
  parseRgbaString,
  createRgbaInputControl,
  createColorModeControl,
  createSliderControl,
  createCheckboxControl,
  createTextInputControl,
  createSelectControl
} from './ui-controls';

/**
 * ============================================================================
 * 🏎️ Competitive HUD Designer Controller
 * ============================================================================
 */

export function initCompetitiveDesigner(
  onInsertCallbackRef: { fn: ((inst: ComponentInstance) => void) | null }
): void {
  let competitiveLayout: ComponentInstance[] = loadCompetitiveLayout();
  let globalLayoutSettings: GlobalLayoutSettings = loadGlobalLayoutSettings();
  let selectedCompId: string | null = null;
  let selectedAnchor: AnchorType = 'center';

  const compList = document.getElementById('competitive-component-list');
  const editCheck = document.getElementById('layout-editing-check') as HTMLInputElement | null;
  const tierSelect = document.getElementById('filter-tier-select') as HTMLSelectElement | null;
  const filterRegexInput = document.getElementById('component-filter-regex') as HTMLInputElement | null;
  const copyBtn = document.getElementById('copy-layout-btn');
  const pasteBtn = document.getElementById('paste-layout-btn');
  const resetBtn = document.getElementById('reset-layout-btn');
  const importModal = document.getElementById('import-modal');
  const importJsonInput = document.getElementById('import-json-input') as HTMLTextAreaElement | null;
  const cancelImportBtn = document.getElementById('cancel-import-btn');
  const confirmImportBtn = document.getElementById('confirm-import-btn');

  const addSelect = document.getElementById('add-component-select') as HTMLSelectElement | null;
  const addBtn = document.getElementById('add-component-btn') as HTMLButtonElement | null;
  const collapseAllBtn = document.getElementById('collapse-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');

  // Layer Filter & Regex search controls
  const layerFilterRegexInput = document.getElementById('layer-filter-regex') as HTMLInputElement | null;
  const layerFilterClearBtn = document.getElementById('layer-filter-clear-btn') as HTMLButtonElement | null;
  const layerFilterClearActionBtn = document.getElementById('layer-filter-clear-action-btn') as HTMLButtonElement | null;
  const layerFilteringIndicator = document.getElementById('layer-filtering-indicator') as HTMLElement | null;
  const layerFilterCountBadge = document.getElementById('layer-filter-count-badge') as HTMLElement | null;
  const layerFilterIndicatorReset = document.getElementById('layer-filter-indicator-reset') as HTMLButtonElement | null;

  function clearLayerFilter() {
    if (layerFilterRegexInput) {
      layerFilterRegexInput.value = '';
      layerFilterRegexInput.focus();
    }
    renderComponentList();
  }

  layerFilterClearBtn?.addEventListener('click', clearLayerFilter);
  layerFilterClearActionBtn?.addEventListener('click', clearLayerFilter);
  layerFilterIndicatorReset?.addEventListener('click', clearLayerFilter);

  layerFilterRegexInput?.addEventListener('input', () => {
    renderComponentList();
  });

  layerFilterRegexInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearLayerFilter();
    }
  });

  const targetPlayerSelect = document.getElementById('add-target-player-select') as HTMLSelectElement | null;
  const speedUnitSelect = document.getElementById('add-speed-unit-select') as HTMLSelectElement | null;
  const alignSelect = document.getElementById('add-align-select') as HTMLSelectElement | null;
  const followAspectCheck = document.getElementById('add-follow-aspect-check') as HTMLInputElement | null;

  // 9-Grid Anchor selection buttons
  const anchorBtns = document.querySelectorAll<HTMLButtonElement>('.anchor-grid-btn');
  anchorBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      anchorBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedAnchor = (btn.getAttribute('data-anchor') as AnchorType) || 'center';
    });
  });

  // Global Settings Controls
  const globalControlsBox = document.getElementById('global-settings-controls');
  function renderGlobalSettingsUI() {
    if (!globalControlsBox) return;
    globalControlsBox.innerHTML = '';

    const saveGlobal = () => {
      saveGlobalLayoutSettings(globalLayoutSettings);
      emitTo('overlay', 'update-global-settings', { settings: globalLayoutSettings });
    };

    // Global HUD Opacity
    const opacityCtrl = createSliderControl(
      'Global HUD Opacity',
      10,
      100,
      5,
      Math.round(globalLayoutSettings.opacity * 100),
      '%',
      (val) => {
        globalLayoutSettings.opacity = val / 100;
        saveGlobal();
      }
    );
    globalControlsBox.appendChild(opacityCtrl);

    // Global Text Color
    const textColorCtrl = createRgbaInputControl(
      'Global Text Color Override',
      globalLayoutSettings.textColor,
      '#ffffff',
      1.0,
      (val) => {
        globalLayoutSettings.textColor = val;
        saveGlobal();
      }
    );
    globalControlsBox.appendChild(textColorCtrl);

    // Global Outside Stroke Width
    const strokeWCtrl = createSliderControl(
      'Global Stroke Width',
      0,
      1.0,
      0.01,
      Number(globalLayoutSettings.strokeWidth ?? 0),
      'vw',
      (val) => {
        globalLayoutSettings.strokeWidth = val;
        saveGlobal();
      }
    );
    globalControlsBox.appendChild(strokeWCtrl);

    // Global Outside Stroke Color
    const strokeColorCtrl = createRgbaInputControl(
      'Global Stroke Color',
      globalLayoutSettings.strokeColor,
      '#000000',
      1.0,
      (val) => {
        globalLayoutSettings.strokeColor = val;
        saveGlobal();
      }
    );
    globalControlsBox.appendChild(strokeColorCtrl);

    // Global Element Card Background Color
    const cardBgCtrl = createRgbaInputControl(
      'Global Card BG Color & Opacity',
      globalLayoutSettings.cardBgColor || globalLayoutSettings.bgColor || "#0a0e17",
      '#0a0e17',
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
      'Global Card Corner Radius',
      0,
      2.0,
      0.05,
      Number(globalLayoutSettings.cardBorderRadius ?? globalLayoutSettings.bgRadius ?? 0),
      'vw',
      (val) => {
        globalLayoutSettings.cardBorderRadius = val;
        globalLayoutSettings.bgRadius = val;
        saveGlobal();
      }
    );
    globalControlsBox.appendChild(cardRadiusCtrl);
  }

  renderGlobalSettingsUI();

  // Populate Add Component Dropdown
  function updateComponentDropdown() {
    if (!addSelect) return;
    addSelect.innerHTML = '';

    const selectedTier = tierSelect?.value || 'all';
    const query = filterRegexInput?.value.trim() || '';

    const allMetas = getAllComponentMetas();
    const filteredMetas = allMetas.filter((meta) => {
      const matchTier = selectedTier === 'all' || meta.tier === selectedTier;
      const matchQuery = matchesRegexOrQuery(`${meta.displayName} ${meta.id}`, query);
      return matchTier && matchQuery;
    });

    if (filteredMetas.length === 0) {
      addSelect.innerHTML = '<option value="" disabled selected>No components matching filter</option>';
      if (addBtn) addBtn.disabled = true;
      return;
    }

    if (addBtn) addBtn.disabled = false;

    const playerMetas = filteredMetas.filter((m) => m.category === 'player');
    const globalMetas = filteredMetas.filter((m) => m.category !== 'player');

    if (playerMetas.length > 0) {
      const playerGroup = document.createElement('optgroup');
      playerGroup.label = 'Player Relative (玩家相关)';
      playerMetas.forEach((meta) => {
        const opt = document.createElement('option');
        opt.value = meta.id;
        opt.textContent = `[${meta.tier.toUpperCase()}] ${meta.displayName}`;
        playerGroup.appendChild(opt);
      });
      addSelect.appendChild(playerGroup);
    }

    if (globalMetas.length > 0) {
      const globalGroup = document.createElement('optgroup');
      globalGroup.label = 'Global Stats (全局数据)';
      globalMetas.forEach((meta) => {
        const opt = document.createElement('option');
        opt.value = meta.id;
        opt.textContent = `[${meta.tier.toUpperCase()}] ${meta.displayName}`;
        globalGroup.appendChild(opt);
      });
      addSelect.appendChild(globalGroup);
    }

    updateDynamicFieldVisibility();
  }

  function updateDynamicFieldVisibility() {
    if (!addSelect) return;
    const meta = COMPONENT_METAS[addSelect.value];
    if (!meta) return;

    if (targetPlayerSelect) {
      targetPlayerSelect.style.display = meta.category === 'player' ? 'block' : 'none';
    }
    if (speedUnitSelect) {
      speedUnitSelect.style.display = meta.supportsSpeedUnit ? 'block' : 'none';
    }
    if (alignSelect) {
      alignSelect.style.display = meta.supportsAlignment ? 'block' : 'none';
    }
    if (followAspectCheck) {
      followAspectCheck.checked = true;
    }
  }

  tierSelect?.addEventListener('change', updateComponentDropdown);
  filterRegexInput?.addEventListener('input', updateComponentDropdown);
  addSelect?.addEventListener('change', updateDynamicFieldVisibility);
  updateComponentDropdown();

  // Layout Adjustment Checkbox
  if (editCheck) {
    editCheck.addEventListener('change', () => {
      const isEnabled = editCheck.checked;
      emitTo('overlay', 'toggle-layout-editing', isEnabled);
      emitTo('overlay', 'toggle-layout-editing', { enabled: isEnabled });
      void setOverlayClickThrough(!isEnabled);
      if (!isEnabled) {
        selectComponent(null);
      }
    });
  }

  collapseAllBtn?.addEventListener('click', () => {
    if (!compList) return;
    compList.querySelectorAll('.advanced-drawer.open').forEach((drawer) => {
      drawer.classList.remove('open');
    });
    compList.querySelectorAll('.toggle-advanced-btn').forEach((btn) => {
      btn.classList.add('btn-secondary');
      btn.classList.remove('btn-primary');
    });
  });

  deselectAllBtn?.addEventListener('click', () => {
    selectComponent(null);
  });

  function insertComponentInstance(newInst: ComponentInstance) {
    competitiveLayout.push(newInst);
    saveCompetitiveLayout(competitiveLayout);
    emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
    renderComponentList();
    selectComponent(newInst.instanceId);
  }

  onInsertCallbackRef.fn = insertComponentInstance;

  if (addBtn && addSelect) {
    addBtn.addEventListener('click', () => {
      const type = addSelect.value;
      const targetP = (targetPlayerSelect?.value as TargetPlayer) || 'p1';
      const speedU = (speedUnitSelect?.value as SpeedUnit) || 'kph';
      const align = (alignSelect?.value as TextAlignment) || 'right';
      const followAspect = followAspectCheck?.checked ?? true;

      const newInst = createNewComponentInstance(type, targetP, speedU, align, followAspect, selectedAnchor);
      insertComponentInstance(newInst);
    });
  }

  function renderComponentCustomPropsBox(inst: ComponentInstance, propsBox: HTMLElement) {
    inst.customProps = inst.customProps || {};
    propsBox.innerHTML = '';

    const saveAndEmit = () => {
      saveCompetitiveLayout(competitiveLayout);
      emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
    };

    const isCustomText = inst.componentType === 'element-custom-text' || inst.componentType === 'custom-text';
    const isStaticText = inst.componentType === 'element-static-text';
    const isTextType = isTextComponent(inst.componentType);
    const isTeamColorBox = inst.componentType === 'element-team-color-box';
    const isCountdownIndicator = inst.componentType === 'element-countdown-indicator';
    const isIndicator = (inst.componentType.includes('indicator') || inst.componentType.includes('status')) && !isTextType && !isCountdownIndicator;
    const isBoostAlertBar = inst.componentType === 'element-boost-alert-bar';
    const isBoostBar = (inst.componentType.includes('boost-bar') || inst.componentType.includes('boost-combo')) && !inst.componentType.includes('curved') && !isBoostAlertBar;
    const isBoostText = inst.componentType === 'element-boost-text' || inst.componentType.includes('boost-val');
    const isSpeedBar = inst.componentType.includes('speed-bar') && !inst.componentType.includes('curved');
    const isCurvedBoost = inst.componentType === 'element-curved-boost-bar';
    const isCurvedSpeed = inst.componentType === 'element-curved-speedometer';
    const isMiniMap = inst.componentType === 'widget-mini-map' || inst.componentType === 'mini-map';
    const isRespawnTimer = inst.componentType === 'widget-respawn-timer' || inst.componentType === 'respawn-timer';

    // 🎨 Six-Color System for Team Color Box
    if (isTeamColorBox) {
      propsBox.appendChild(
        createColorModeControl(
          'Box Color Source',
          inst.customProps?.boxColorMode as ColorSource,
          inst.customProps?.bgColor,
          '#1873FF',
          (mode, color) => {
            inst.customProps!.boxColorMode = mode;
            inst.customProps!.bgColor = color;
            saveAndEmit();
          }
        )
      );
    }

    if (!inst.followGlobal) {
      const overrideHeader = document.createElement('div');
      overrideHeader.style.fontSize = '10px';
      overrideHeader.style.fontWeight = 'bold';
      overrideHeader.style.color = 'var(--primer-warning-fg)';
      overrideHeader.style.paddingBottom = '4px';
      overrideHeader.textContent = 'Individual Style Overrides:';
      propsBox.appendChild(overrideHeader);

      // Card BG Color Mode & Color
      const bgCtrl = createColorModeControl(
        'Background Color',
        inst.customProps?.bgColorMode as ColorSource,
        inst.customProps?.bgColor,
        'rgba(10, 14, 23, 0.85)',
        (mode, color) => {
          inst.customProps!.bgColorMode = mode;
          inst.customProps!.bgColor = color;
          saveAndEmit();
        }
      );
      propsBox.appendChild(bgCtrl);

      // Card Border Radius
      const radiusCtrl = createSliderControl(
        'Card Corner Radius',
        0,
        2.0,
        0.05,
        inst.customProps?.bgRadius !== undefined ? Number(inst.customProps.bgRadius) : (inst.customProps?.borderRadius !== undefined ? Number(inst.customProps.borderRadius) : 0),
        'vw',
        (val) => {
          inst.customProps!.bgRadius = val;
          inst.customProps!.borderRadius = val;
          saveAndEmit();
        }
      );
      propsBox.appendChild(radiusCtrl);

      // Text Color Mode & Color (Six-Color System)
      if (isTextType) {
        const textCtrl = createColorModeControl(
          'Text Color Mode',
          inst.customProps?.textColorMode as ColorSource,
          inst.customProps?.textColor,
          '#ffffff',
          (mode, color) => {
            inst.customProps!.textColorMode = mode;
            inst.customProps!.textColor = color;
            saveAndEmit();
          }
        );
        propsBox.appendChild(textCtrl);

        const strokeCtrl = createSliderControl(
          'Outside Stroke Width',
          0,
          1.0,
          0.01,
          inst.customProps?.strokeWidth !== undefined ? Number(inst.customProps.strokeWidth) : 0,
          'vw',
          (val) => {
            inst.customProps!.strokeWidth = val;
            saveAndEmit();
          }
        );
        propsBox.appendChild(strokeCtrl);

        const strokeColorCtrl = createRgbaInputControl(
          'Outside Stroke Color',
          inst.customProps?.strokeColor || '#000000',
          '#000000',
          1.0,
          (val) => {
            inst.customProps!.strokeColor = val;
            saveAndEmit();
          }
        );
        propsBox.appendChild(strokeColorCtrl);
      }
    }

    // Custom Text content
    if (isCustomText) {
      propsBox.appendChild(
        createTextInputControl('Custom Text String', inst.customProps?.customText || 'SUPERSONIC', 'e.g. SUPERSONIC', (val) => {
          inst.customProps!.customText = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createSelectControl(
          'Bind Boolean Variable',
          [
            { label: 'Supersonic', value: 'supersonic' },
            { label: 'Boosting', value: 'boosting' },
            { label: 'Has Car (Active)', value: 'hascar' },
            { label: 'On Ground', value: 'onground' },
            { label: 'On Wall', value: 'onwall' },
            { label: 'Powersliding', value: 'powersliding' },
            { label: 'Demolished', value: 'demolished' },
            { label: 'Overtime', value: 'overtime' }
          ],
          inst.customProps?.boolVar || 'supersonic',
          (val) => {
            inst.customProps!.boolVar = val;
            saveAndEmit();
          }
        )
      );
      propsBox.appendChild(
        createCheckboxControl('Invert Boolean Condition', Boolean(inst.customProps?.invertBool), (val) => {
          inst.customProps!.invertBool = val;
          saveAndEmit();
        })
      );
    }

    if (isStaticText) {
      propsBox.appendChild(
        createTextInputControl('Static Label Text', inst.customProps?.staticText || 'LABEL', 'e.g. SPEED, BOOST', (val) => {
          inst.customProps!.staticText = val;
          saveAndEmit();
        })
      );
    }

    if (isBoostBar || isBoostText || isCurvedBoost) {
      propsBox.appendChild(
        createCheckboxControl('Enable Low Boost Blinking (<12)', inst.customProps?.enableBlink !== false, (val) => {
          inst.customProps!.enableBlink = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createRgbaInputControl('High Boost Color (>=60)', inst.customProps?.colorHigh || '#10b981', '#10b981', 1.0, (val) => {
          inst.customProps!.colorHigh = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createRgbaInputControl('Mid Boost Color (20-59)', inst.customProps?.colorMid || '#f59e0b', '#f59e0b', 1.0, (val) => {
          inst.customProps!.colorMid = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createRgbaInputControl('Low Boost Color (<20)', inst.customProps?.colorLow || '#ef4444', '#ef4444', 1.0, (val) => {
          inst.customProps!.colorLow = val;
          saveAndEmit();
        })
      );
    }

    // Speed Bar & Curved Speedometer multi-tier colors & 1410 position
    if (isSpeedBar || isCurvedSpeed) {
      propsBox.appendChild(
        createSliderControl(
          '1410 Speed Position (%)',
          10,
          60,
          1,
          Number(inst.customProps?.split1410Pos ?? inst.customProps?.pos1410 ?? 40),
          '%',
          (val) => {
            inst.customProps!.split1410Pos = val;
            saveAndEmit();
          }
        )
      );
      propsBox.appendChild(
        createRgbaInputControl('Low Speed Color (0-1410)', inst.customProps?.colorLow || '#d4af37', '#d4af37', 1.0, (val) => {
          inst.customProps!.colorLow = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createRgbaInputControl('Mid Speed Start (1410)', inst.customProps?.colorMidStart || '#77ca7a', '#77ca7a', 1.0, (val) => {
          inst.customProps!.colorMidStart = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createRgbaInputControl('Mid Speed End (2200)', inst.customProps?.colorMidEnd || '#59f168', '#59f168', 1.0, (val) => {
          inst.customProps!.colorMidEnd = val;
          saveAndEmit();
        })
      );
    }

    if (isBoostAlertBar) {
      propsBox.appendChild(
        createSliderControl('Alert Boost Threshold', 1, 50, 1, Number(inst.customProps?.threshold ?? 12), '', (val) => {
          inst.customProps!.threshold = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createRgbaInputControl('Alert Border Color', inst.customProps?.alertColor || '#ef4444', '#ef4444', 1.0, (val) => {
          inst.customProps!.alertColor = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createSliderControl('Border Width', 0.02, 0.5, 0.01, Number(inst.customProps?.borderWidth ?? 0.1), 'vw', (val) => {
          inst.customProps!.borderWidth = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createCheckboxControl('Enable Pulsing Animation', inst.customProps?.enableBlink !== false, (val) => {
          inst.customProps!.enableBlink = val;
          saveAndEmit();
        })
      );
    }

    if (isCurvedBoost || isCurvedSpeed) {
      propsBox.appendChild(
        createSliderControl('Arc Gap Angle (Degrees)', 0, 360, 5, Number(inst.customProps?.gap ?? 90), '°', (val) => {
          inst.customProps!.gap = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createSliderControl('Gauge Thickness (%)', 0, 50, 1, Number(inst.customProps?.thickness ?? 8), '%', (val) => {
          inst.customProps!.thickness = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createSliderControl('Orientation (Degrees)', 0, 360, 15, Number(inst.customProps?.orientation ?? 90), '°', (val) => {
          inst.customProps!.orientation = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createRgbaInputControl('Track Color', inst.customProps?.trackColor || 'rgba(255, 255, 255, 0.15)', '#ffffff', 0.15, (val) => {
          inst.customProps!.trackColor = val;
          saveAndEmit();
        })
      );
    }

    // Countdown Indicator Controls
    if (isCountdownIndicator) {
      propsBox.appendChild(
        createRgbaInputControl(
          'Countdown Color (4/3/2/1)',
          inst.customProps?.countdownColor || '#ef4444',
          '#ef4444',
          1.0,
          (val) => {
            inst.customProps!.countdownColor = val;
            saveAndEmit();
          }
        )
      );
      propsBox.appendChild(
        createRgbaInputControl(
          'Round Started Color (0)',
          inst.customProps?.roundStartColor || '#22c55e',
          '#22c55e',
          1.0,
          (val) => {
            inst.customProps!.roundStartColor = val;
            saveAndEmit();
          }
        )
      );
      propsBox.appendChild(
        createSliderControl(
          'Digit Fade Duration (s)',
          0.1,
          3.0,
          0.1,
          Number(inst.customProps?.fadeDuration ?? 0.5),
          's',
          (val) => {
            inst.customProps!.fadeDuration = val;
            saveAndEmit();
          }
        )
      );
      propsBox.appendChild(
        createCheckboxControl(
          "Show '4' on Countdown Begin / 显示初始 '4'",
          inst.customProps?.showInitialFour !== false,
          (val) => {
            inst.customProps!.showInitialFour = val;
            saveAndEmit();
          }
        )
      );

      const testBtnGroup = document.createElement('div');
      testBtnGroup.style.display = 'flex';
      testBtnGroup.style.flexDirection = 'column';
      testBtnGroup.style.gap = '6px';
      testBtnGroup.style.marginTop = '8px';

      const row1 = document.createElement('div');
      row1.style.display = 'flex';
      row1.style.gap = '6px';

      const testCountdownBtn = document.createElement('button');
      testCountdownBtn.className = 'btn btn-sm';
      testCountdownBtn.style.flex = '1';
      testCountdownBtn.style.background = '#ef4444';
      testCountdownBtn.style.color = '#ffffff';
      testCountdownBtn.style.fontSize = '11px';
      testCountdownBtn.style.padding = '4px 6px';
      testCountdownBtn.textContent = 'Test Countdown (4-3-2-1)';
      testCountdownBtn.onclick = () => {
        emitTo('overlay', 'trigger-countdown-begin');
      };

      const testRoundStartBtn = document.createElement('button');
      testRoundStartBtn.className = 'btn btn-sm';
      testRoundStartBtn.style.flex = '1';
      testRoundStartBtn.style.background = '#22c55e';
      testRoundStartBtn.style.color = '#ffffff';
      testRoundStartBtn.style.fontSize = '11px';
      testRoundStartBtn.style.padding = '4px 6px';
      testRoundStartBtn.textContent = 'Test Round Start (0)';
      testRoundStartBtn.onclick = () => {
        emitTo('overlay', 'trigger-round-start');
      };

      row1.appendChild(testCountdownBtn);
      row1.appendChild(testRoundStartBtn);

      const testFullBtn = document.createElement('button');
      testFullBtn.className = 'btn btn-sm btn-primary';
      testFullBtn.style.fontSize = '11px';
      testFullBtn.style.padding = '4px 6px';
      testFullBtn.textContent = '▶ Simulate Match Countdown (4 → 3 → 2 → 1 → 0)';
      testFullBtn.onclick = () => {
        emitTo('overlay', 'trigger-countdown-begin');
        setTimeout(() => {
          emitTo('overlay', 'trigger-round-start');
        }, 4000);
      };

      testBtnGroup.appendChild(row1);
      testBtnGroup.appendChild(testFullBtn);
      propsBox.appendChild(testBtnGroup);
    }

    // Indicators (Six-Color Active Mode)
    if (isIndicator) {
      let defaultColor = '#30d158';
      if (inst.componentType === 'element-demolished-indicator') defaultColor = '#ff453a';
      else if (inst.componentType === 'element-boosting-indicator') defaultColor = '#ff9500';
      else if (inst.componentType === 'element-onground-indicator') defaultColor = '#0a84ff';
      else if (inst.componentType === 'element-onwall-indicator') defaultColor = '#bf5af2';
      else if (inst.componentType === 'element-powersliding-indicator') defaultColor = '#ffd60a';
      else if (inst.componentType === 'element-supersonic-indicator') defaultColor = '#bf5af2';
      else if (inst.componentType === 'element-overtime-indicator') defaultColor = '#ff453a';

      propsBox.appendChild(
        createColorModeControl(
          'Active Color Mode',
          inst.customProps?.activeColorMode as ColorSource,
          inst.customProps?.activeColor,
          defaultColor,
          (mode, color) => {
            inst.customProps!.activeColorMode = mode;
            inst.customProps!.activeColor = color;
            saveAndEmit();
          }
        )
      );
      propsBox.appendChild(
        createRgbaInputControl('Inactive Color', inst.customProps?.inactiveColor || 'rgba(51, 65, 85, 0.5)', '#334155', 0.5, (val) => {
          inst.customProps!.inactiveColor = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createCheckboxControl('Invert Indicator Trigger', Boolean(inst.customProps?.invertBool), (val) => {
          inst.customProps!.invertBool = val;
          saveAndEmit();
        })
      );
    }

    // Mini-Map & Ball Hit Pitch Widget
    if (isMiniMap) {
      const miniMapHeader = document.createElement('div');
      miniMapHeader.style.fontSize = '11px';
      miniMapHeader.style.fontWeight = 'bold';
      miniMapHeader.style.color = 'var(--primer-accent-fg)';
      miniMapHeader.style.borderBottom = '1px solid var(--primer-border-muted)';
      miniMapHeader.style.paddingBottom = '4px';
      miniMapHeader.style.marginTop = '6px';
      miniMapHeader.textContent = 'Mini-Map & Ball Hit Tuning:';
      propsBox.appendChild(miniMapHeader);

      // Simulation Triggers
      const simRow = document.createElement('div');
      simRow.style.display = 'flex';
      simRow.style.gap = '6px';
      simRow.style.marginTop = '4px';
      simRow.style.marginBottom = '6px';

      const simMyBtn = document.createElement('button');
      simMyBtn.className = 'primer-btn primer-btn-sm';
      simMyBtn.style.flex = '1';
      simMyBtn.style.fontSize = '10px';
      simMyBtn.style.color = '#00ff88';
      simMyBtn.textContent = '⚡ Sim Our Hit';
      simMyBtn.addEventListener('click', () => {
        emitTo('overlay', 'simulate-widget-ball-hit', { isMyTeam: true, speed: 85 });
      });

      const simOppBtn = document.createElement('button');
      simOppBtn.className = 'primer-btn primer-btn-sm';
      simOppBtn.style.flex = '1';
      simOppBtn.style.fontSize = '10px';
      simOppBtn.style.color = '#ff3366';
      simOppBtn.textContent = '⚡ Sim Opp Hit';
      simOppBtn.addEventListener('click', () => {
        emitTo('overlay', 'simulate-widget-ball-hit', { isMyTeam: false, speed: 85 });
      });

      simRow.appendChild(simMyBtn);
      simRow.appendChild(simOppBtn);
      propsBox.appendChild(simRow);

      // Auto Flip 180°
      propsBox.appendChild(
        createCheckboxControl('Auto 180° Flip on Orange Team', inst.customProps.autoFlip180 !== false, (val) => {
          inst.customProps!.autoFlip180 = val;
          saveAndEmit();
        })
      );

      // Container BG
      propsBox.appendChild(
        createRgbaInputControl(
          'Container Background',
          inst.customProps.containerBgColor || '#04070e',
          '#04070e',
          (inst.customProps.containerBgOpacity ?? 85) / 100,
          (rgba) => {
            const p = parseRgbaString(rgba, '#04070e', 0.85);
            inst.customProps!.containerBgColor = p.hex;
            inst.customProps!.containerBgOpacity = Math.round(p.alpha * 100);
            saveAndEmit();
          }
        )
      );

      // Pitch Field Fill
      propsBox.appendChild(
        createRgbaInputControl(
          'Pitch Field Fill',
          inst.customProps.bgFillColor || '#0a0f19',
          '#0a0f19',
          (inst.customProps.bgFillOpacity ?? 70) / 100,
          (rgba) => {
            const p = parseRgbaString(rgba, '#0a0f19', 0.70);
            inst.customProps!.bgFillColor = p.hex;
            inst.customProps!.bgFillOpacity = Math.round(p.alpha * 100);
            saveAndEmit();
          }
        )
      );

      // Pitch Boundary
      propsBox.appendChild(
        createSliderControl(
          'Boundary Width (uu)',
          10,
          250,
          5,
          inst.customProps.borderStrokeWidth ?? 75,
          'uu',
          (val) => {
            inst.customProps!.borderStrokeWidth = val;
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createRgbaInputControl(
          'Boundary Color',
          inst.customProps.borderColor || '#00f0ff',
          '#00f0ff',
          (inst.customProps.borderOpacity ?? 85) / 100,
          (rgba) => {
            const p = parseRgbaString(rgba, '#00f0ff', 0.85);
            inst.customProps!.borderColor = p.hex;
            inst.customProps!.borderOpacity = Math.round(p.alpha * 100);
            saveAndEmit();
          }
        )
      );

      // Pitch Markings
      propsBox.appendChild(
        createRgbaInputControl(
          'Pitch Markings Color',
          inst.customProps.pitchLineColor || '#ffffff',
          '#ffffff',
          (inst.customProps.pitchLineOpacity ?? 22) / 100,
          (rgba) => {
            const p = parseRgbaString(rgba, '#ffffff', 0.22);
            inst.customProps!.pitchLineColor = p.hex;
            inst.customProps!.pitchLineOpacity = Math.round(p.alpha * 100);
            saveAndEmit();
          }
        )
      );

      // Boost Resources
      const boostHeader = document.createElement('div');
      boostHeader.style.fontSize = '10px';
      boostHeader.style.fontWeight = 'bold';
      boostHeader.style.color = '#f59e0b';
      boostHeader.style.marginTop = '6px';
      boostHeader.textContent = 'Boost Resources:';
      propsBox.appendChild(boostHeader);

      propsBox.appendChild(
        createSliderControl(
          'Small Pad Radius',
          30,
          200,
          5,
          inst.customProps.padRadius ?? 90,
          'uu',
          (val) => {
            inst.customProps!.padRadius = val;
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createRgbaInputControl(
          'Small Pad Color',
          inst.customProps.padColor || '#fbbf24',
          '#fbbf24',
          (inst.customProps.padOpacity ?? 80) / 100,
          (rgba) => {
            const p = parseRgbaString(rgba, '#fbbf24', 0.80);
            inst.customProps!.padColor = p.hex;
            inst.customProps!.padOpacity = Math.round(p.alpha * 100);
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createSliderControl(
          'Big Pill Scale',
          100,
          600,
          20,
          inst.customProps.pillRadiusScale ?? 280,
          '%',
          (val) => {
            inst.customProps!.pillRadiusScale = val;
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createRgbaInputControl(
          'Big Pill Color',
          inst.customProps.pillColor || '#f59e0b',
          '#f59e0b',
          (inst.customProps.pillOpacity ?? 90) / 100,
          (rgba) => {
            const p = parseRgbaString(rgba, '#f59e0b', 0.90);
            inst.customProps!.pillColor = p.hex;
            inst.customProps!.pillOpacity = Math.round(p.alpha * 100);
            saveAndEmit();
          }
        )
      );

      // Center Hit Dot
      const dotHeader = document.createElement('div');
      dotHeader.style.fontSize = '10px';
      dotHeader.style.fontWeight = 'bold';
      dotHeader.style.color = '#38bdf8';
      dotHeader.style.marginTop = '6px';
      dotHeader.textContent = 'Ball Hit Center Dot:';
      propsBox.appendChild(dotHeader);

      propsBox.appendChild(
        createSliderControl(
          'Center Dot Radius',
          0.05,
          1.0,
          0.01,
          Number(inst.customProps.dotRadius ?? 0.25),
          'vw',
          (val) => {
            inst.customProps!.dotRadius = val;
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createRgbaInputControl(
          'Our Team Hit Dot',
          inst.customProps.myTeamDotColor || '#00ff88',
          '#00ff88',
          (inst.customProps.myTeamDotOpacity ?? 100) / 100,
          (rgba) => {
            const p = parseRgbaString(rgba, '#00ff88', 1.0);
            inst.customProps!.myTeamDotColor = p.hex;
            inst.customProps!.myTeamDotOpacity = Math.round(p.alpha * 100);
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createRgbaInputControl(
          'Opp Team Hit Dot',
          inst.customProps.oppTeamDotColor || '#ff3366',
          '#ff3366',
          (inst.customProps.oppTeamDotOpacity ?? 100) / 100,
          (rgba) => {
            const p = parseRgbaString(rgba, '#ff3366', 1.0);
            inst.customProps!.oppTeamDotColor = p.hex;
            inst.customProps!.oppTeamDotOpacity = Math.round(p.alpha * 100);
            saveAndEmit();
          }
        )
      );

      // Outer Speed Ring
      const ringHeader = document.createElement('div');
      ringHeader.style.fontSize = '10px';
      ringHeader.style.fontWeight = 'bold';
      ringHeader.style.color = '#a855f7';
      ringHeader.style.marginTop = '6px';
      ringHeader.textContent = 'Ball Speed Outer Ring:';
      propsBox.appendChild(ringHeader);

      propsBox.appendChild(
        createSliderControl(
          'Max Ring Diameter',
          10,
          100,
          5,
          inst.customProps.ringMaxPercent ?? 100,
          '%',
          (val) => {
            inst.customProps!.ringMaxPercent = val;
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createSliderControl(
          'Ring Border Width',
          0.02,
          0.5,
          0.01,
          Number(inst.customProps.ringBorderWidth ?? 0.1),
          'vw',
          (val) => {
            inst.customProps!.ringBorderWidth = val;
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createRgbaInputControl(
          'Our Ring Border',
          inst.customProps.myTeamRingBorderColor || '#00ff88',
          '#00ff88',
          (inst.customProps.myTeamRingBorderOpacity ?? 85) / 100,
          (rgba) => {
            const p = parseRgbaString(rgba, '#00ff88', 0.85);
            inst.customProps!.myTeamRingBorderColor = p.hex;
            inst.customProps!.myTeamRingBorderOpacity = Math.round(p.alpha * 100);
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createRgbaInputControl(
          'Our Ring Fill',
          inst.customProps.myTeamRingFillColor || '#00ff88',
          '#00ff88',
          (inst.customProps.myTeamRingFillOpacity ?? 15) / 100,
          (rgba) => {
            const p = parseRgbaString(rgba, '#00ff88', 0.15);
            inst.customProps!.myTeamRingFillColor = p.hex;
            inst.customProps!.myTeamRingFillOpacity = Math.round(p.alpha * 100);
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createRgbaInputControl(
          'Opp Ring Border',
          inst.customProps.oppTeamRingBorderColor || '#ff3366',
          '#ff3366',
          (inst.customProps.oppTeamRingBorderOpacity ?? 85) / 100,
          (rgba) => {
            const p = parseRgbaString(rgba, '#ff3366', 0.85);
            inst.customProps!.oppTeamRingBorderColor = p.hex;
            inst.customProps!.oppTeamRingBorderOpacity = Math.round(p.alpha * 100);
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createRgbaInputControl(
          'Opp Ring Fill',
          inst.customProps.oppTeamRingFillColor || '#ff3366',
          '#ff3366',
          (inst.customProps.oppTeamRingFillOpacity ?? 15) / 100,
          (rgba) => {
            const p = parseRgbaString(rgba, '#ff3366', 0.15);
            inst.customProps!.oppTeamRingFillColor = p.hex;
            inst.customProps!.oppTeamRingFillOpacity = Math.round(p.alpha * 100);
            saveAndEmit();
          }
        )
      );

      // Animation & Fade Timing
      const animHeader = document.createElement('div');
      animHeader.style.fontSize = '10px';
      animHeader.style.fontWeight = 'bold';
      animHeader.style.color = '#ec4899';
      animHeader.style.marginTop = '6px';
      animHeader.textContent = 'Hit Marker Fade Animation:';
      propsBox.appendChild(animHeader);

      propsBox.appendChild(
        createSliderControl(
          'Hold Duration',
          0.0,
          3.0,
          0.05,
          Number(inst.customProps.animHoldDuration ?? 0.5),
          's',
          (val) => {
            inst.customProps!.animHoldDuration = val;
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createSliderControl(
          'Fade Duration',
          0.1,
          5.0,
          0.05,
          Number(inst.customProps.animFadeDuration ?? 1.0),
          's',
          (val) => {
            inst.customProps!.animFadeDuration = val;
            saveAndEmit();
          }
        )
      );

      propsBox.appendChild(
        createSelectControl(
          'Fade Easing Curve',
          [
            { label: 'Ease Out', value: 'ease-out' },
            { label: 'Ease In', value: 'ease-in' },
            { label: 'Ease In Out', value: 'ease-in-out' },
            { label: 'Linear', value: 'linear' },
            { label: 'Custom Cubic Bezier', value: 'custom' }
          ],
          inst.customProps.animEasingType || 'ease-out',
          (val) => {
            inst.customProps!.animEasingType = val as any;
            saveAndEmit();
          }
        )
      );

      if (inst.customProps.animEasingType === 'custom') {
        propsBox.appendChild(
          createTextInputControl(
            'Cubic Bezier Definition',
            inst.customProps.animCustomEasing || 'cubic-bezier(0.4, 0, 0.2, 1)',
            'e.g. cubic-bezier(0.4, 0, 0.2, 1)',
            (val) => {
              inst.customProps!.animCustomEasing = val;
              saveAndEmit();
            }
          )
        );
      }
    }

    // Respawn Timer (Demolition) Tuning
    if (isRespawnTimer) {
      const respawnHeader = document.createElement('div');
      respawnHeader.style.fontSize = '11px';
      respawnHeader.style.fontWeight = 'bold';
      respawnHeader.style.color = 'var(--primer-accent-fg)';
      respawnHeader.style.borderBottom = '1px solid var(--primer-border-muted)';
      respawnHeader.style.paddingBottom = '4px';
      respawnHeader.style.marginTop = '6px';
      respawnHeader.textContent = 'Respawn Timer & Demolition Tuning:';
      propsBox.appendChild(respawnHeader);

      // Simulation Trigger
      const simRow = document.createElement('div');
      simRow.style.display = 'flex';
      simRow.style.gap = '6px';
      simRow.style.marginTop = '4px';
      simRow.style.marginBottom = '6px';

      const simBtn = document.createElement('button');
      simBtn.className = 'primer-btn primer-btn-sm';
      simBtn.style.flex = '1';
      simBtn.style.fontSize = '11px';
      simBtn.style.color = 'var(--primer-accent-fg)';
      simBtn.textContent = '▶ Test Respawn Animation (3s)';
      simBtn.addEventListener('click', () => {
        emitTo('overlay', 'trigger-respawn-timer');
      });
      simRow.appendChild(simBtn);
      propsBox.appendChild(simRow);

      // Sizing (vw units)
      propsBox.appendChild(
        createSliderControl('Bar Height / Thickness', 0.1, 2.0, 0.05, Number(inst.customProps?.barHeight ?? 0.5), 'vw', (val) => {
          inst.customProps!.barHeight = val;
          saveAndEmit();
        })
      );

      propsBox.appendChild(
        createSliderControl('Bar Corner Radius', 0, 1.0, 0.02, Number(inst.customProps?.barRadius ?? 0.15), 'vw', (val) => {
          inst.customProps!.barRadius = val;
          saveAndEmit();
        })
      );

      propsBox.appendChild(
        createSliderControl('Hourglass Gap / Spacing', 0, 2.0, 0.05, Number(inst.customProps?.barGap ?? 0.4), 'vw', (val) => {
          inst.customProps!.barGap = val;
          saveAndEmit();
        })
      );

      propsBox.appendChild(
        createRgbaInputControl('Track Background Color', inst.customProps?.trackBgColor || 'rgba(255, 255, 255, 0.15)', '#ffffff', 0.15, (val) => {
          inst.customProps!.trackBgColor = val;
          saveAndEmit();
        })
      );

      // Color Stages Tuning
      const stagesHeader = document.createElement('div');
      stagesHeader.style.fontSize = '10px';
      stagesHeader.style.fontWeight = 'bold';
      stagesHeader.style.color = '#f59e0b';
      stagesHeader.style.marginTop = '6px';
      stagesHeader.textContent = 'Color Stages Tuning:';
      propsBox.appendChild(stagesHeader);

      propsBox.appendChild(
        createRgbaInputControl('Stage 1 Color (3s)', inst.customProps?.color3s || '#ffffff', '#ffffff', 1.0, (val) => {
          inst.customProps!.color3s = val;
          saveAndEmit();
        })
      );

      propsBox.appendChild(
        createRgbaInputControl('Stage 2 Color (2s)', inst.customProps?.color2s || '#ffd60a', '#ffd60a', 1.0, (val) => {
          inst.customProps!.color2s = val;
          saveAndEmit();
        })
      );

      propsBox.appendChild(
        createRgbaInputControl('Stage 3 Bar Color (1s)', inst.customProps?.color1s || '#ef4444', '#ef4444', 1.0, (val) => {
          inst.customProps!.color1s = val;
          saveAndEmit();
        })
      );

      propsBox.appendChild(
        createRgbaInputControl('Stage 3 Hourglass Color', inst.customProps?.hourglassRedColor || '#ef4444', '#ef4444', 1.0, (val) => {
          inst.customProps!.hourglassRedColor = val;
          saveAndEmit();
        })
      );


    }

  }

  function renderComponentList() {
    if (!compList) return;
    compList.innerHTML = '';

    const query = layerFilterRegexInput?.value.trim() || '';
    const isFilteringActive = query.length > 0;
    const totalCount = competitiveLayout.length;

    // Filter layout items based on regex query
    const filteredIndices: number[] = [];
    competitiveLayout.forEach((inst, index) => {
      if (!isFilteringActive) {
        filteredIndices.push(index);
        return;
      }

      const meta = COMPONENT_METAS[inst.componentType] || {
        displayName: inst.componentType,
        tier: inst.tier || 'element',
        category: inst.category || (inst.componentType.includes('player') || inst.componentType.includes('boost') || inst.componentType.includes('speed') ? 'player' : 'global'),
        supportsSpeedUnit: false,
        supportsAlignment: false
      };

      const isRespawnTimer = inst.componentType === 'widget-respawn-timer' || inst.componentType === 'respawn-timer';
      const isPlayer = (inst.category === 'player' || meta.category === 'player' || Boolean(inst.targetPlayer)) && !isRespawnTimer;
      const targetP = (inst.targetPlayer || (isPlayer ? 'p1' : 'global')).toLowerCase();
      const customStr = inst.customProps?.customText || inst.customProps?.staticText || '';

      const searchableText = [
        meta.displayName,
        inst.componentType,
        inst.instanceId,
        inst.category || meta.category,
        meta.tier,
        targetP,
        `#${index + 1}`,
        inst.anchor,
        customStr
      ].filter(Boolean).join(' ');

      if (matchesRegexOrQuery(searchableText, query)) {
        filteredIndices.push(index);
      }
    });

    // Update pale-yellow filtering indicator & clear button states
    if (layerFilteringIndicator) {
      layerFilteringIndicator.style.display = isFilteringActive ? 'flex' : 'none';
    }
    if (layerFilterCountBadge) {
      layerFilterCountBadge.textContent = `Showing ${filteredIndices.length} / ${totalCount}`;
    }
    if (layerFilterClearBtn) {
      layerFilterClearBtn.style.display = isFilteringActive ? 'block' : 'none';
    }
    if (layerFilterClearActionBtn) {
      layerFilterClearActionBtn.style.display = isFilteringActive ? 'block' : 'none';
    }

    if (filteredIndices.length === 0) {
      if (isFilteringActive) {
        const emptyCard = document.createElement('div');
        emptyCard.style.textAlign = 'center';
        emptyCard.style.padding = '18px 10px';
        emptyCard.style.color = 'var(--primer-fg-muted)';
        emptyCard.style.fontSize = '11px';
        emptyCard.style.background = 'var(--primer-canvas-subtle)';
        emptyCard.style.borderRadius = '6px';
        emptyCard.style.border = '1px dashed var(--primer-border-default)';
        emptyCard.innerHTML = `
          <div style="margin-bottom: 6px; font-weight: 600;">No added layers match: <span style="color: var(--primer-warning-fg); font-family: monospace;">"${escapeHtml(query)}"</span></div>
          <button type="button" class="btn btn-secondary btn-sm" id="empty-clear-filter-btn" style="margin-top: 4px; font-size: 10px;">✕ Clear Filter</button>
        `;
        emptyCard.querySelector('#empty-clear-filter-btn')?.addEventListener('click', clearLayerFilter);
        compList.appendChild(emptyCard);
      } else {
        const emptyCard = document.createElement('div');
        emptyCard.style.textAlign = 'center';
        emptyCard.style.padding = '18px 10px';
        emptyCard.style.color = 'var(--primer-fg-muted)';
        emptyCard.style.fontSize = '11px';
        emptyCard.style.background = 'var(--primer-canvas-subtle)';
        emptyCard.style.borderRadius = '6px';
        emptyCard.style.border = '1px dashed var(--primer-border-default)';
        emptyCard.textContent = 'No components in HUD layout. Add one above or explore the Catalog.';
        compList.appendChild(emptyCard);
      }
      return;
    }

    filteredIndices.forEach((origIndex) => {
      const inst = competitiveLayout[origIndex];
      const meta = COMPONENT_METAS[inst.componentType] || {
        displayName: inst.componentType,
        tier: inst.tier || 'element',
        category: inst.category || (inst.componentType.includes('player') || inst.componentType.includes('boost') || inst.componentType.includes('speed') ? 'player' : 'global'),
        supportsSpeedUnit: false,
        supportsAlignment: false
      };

      const card = document.createElement('div');
      card.className = `comp-item-card ${inst.instanceId === selectedCompId ? 'selected' : ''}`;
      card.setAttribute('data-id', inst.instanceId);

      const isRespawnTimer = inst.componentType === 'widget-respawn-timer' || inst.componentType === 'respawn-timer';
      const isPlayer = (inst.category === 'player' || meta.category === 'player' || Boolean(inst.targetPlayer)) && !isRespawnTimer;
      const isSpeed = meta.supportsSpeedUnit === true || inst.componentType.includes('speed');
      const isAlign = meta.supportsAlignment === true || inst.componentType.includes('text');

      const tierBadge = meta.tier === 'element'
        ? '<span class="comp-type-tag" style="background: #8250df;">ELEMENT</span>'
        : meta.tier === 'panel'
        ? '<span class="comp-type-tag" style="background: #0969da;">PANEL</span>'
        : '<span class="comp-type-tag" style="background: #1f883d;">WIDGET</span>';

      const playerBadge = isPlayer
        ? `<span class="comp-type-tag" style="background: #bc4c00;">${(inst.targetPlayer || 'p1').toUpperCase()}</span>`
        : '<span class="comp-type-tag" style="background: #656d76;">GLOBAL</span>';

      const isFirst = origIndex === 0;
      const isLast = origIndex === competitiveLayout.length - 1;

      card.innerHTML = `
        <div class="comp-card-header">
          <div class="comp-card-title">
            ${tierBadge}
            ${playerBadge}
            <span class="layer-badge" title="Layer Stacking Order">#${origIndex + 1}</span>
            <span>${meta.displayName || inst.componentType}</span>
          </div>
          
          <div style="display: flex; align-items: center; gap: 4px;">
            <div class="layer-btn-group">
              <button class="layer-btn btn-top" title="Top" ${isLast ? 'disabled' : ''}>⏫</button>
              <button class="layer-btn btn-up" title="Up" ${isLast ? 'disabled' : ''}>🔼</button>
              <button class="layer-btn btn-down" title="Down" ${isFirst ? 'disabled' : ''}>🔽</button>
              <button class="layer-btn btn-bottom" title="Bottom" ${isFirst ? 'disabled' : ''}>⏬</button>
            </div>
            <button class="btn btn-secondary btn-sm toggle-advanced-btn" style="padding: 2px 6px; font-size: 10px;">⚙️ Advanced</button>
            <button class="btn btn-danger btn-sm delete-btn" style="padding: 1px 6px; font-size: 10px;" title="Delete">✕</button>
          </div>
        </div>

        ${
          isPlayer
            ? `
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 6px;">
            <span class="control-label">Target Player:</span>
            <select class="select-field player-select" style="padding: 2px 4px; font-size: 10px; flex: 1;">
              <option value="p1" ${inst.targetPlayer === 'p1' ? 'selected' : ''}>P1 (Target)</option>
              <option value="p2" ${inst.targetPlayer === 'p2' ? 'selected' : ''}>P2 (Team 1)</option>
              <option value="p3" ${inst.targetPlayer === 'p3' ? 'selected' : ''}>P3 (Team 2)</option>
            </select>
          </div>
        `
            : ''
        }

        <div class="advanced-drawer" id="advanced-drawer-${inst.instanceId}">
          <div class="control-row" style="margin-bottom: 6px;">
            <label style="font-size: 11px; color: var(--primer-accent-fg); cursor: pointer; font-weight: bold;">
              <input type="checkbox" class="follow-global-check" ${inst.followGlobal ? 'checked' : ''} style="cursor: pointer; margin-right: 4px;">
              Follow Global Style
            </label>
          </div>

          <div class="control-row">
            <span class="control-label">Snap Anchor:</span>
            <select class="select-field anchor-select" style="padding: 2px 4px; font-size: 10px;">
              <option value="top-left" ${inst.anchor === 'top-left' ? 'selected' : ''}>Top-Left</option>
              <option value="top-center" ${inst.anchor === 'top-center' ? 'selected' : ''}>Top-Center</option>
              <option value="top-right" ${inst.anchor === 'top-right' ? 'selected' : ''}>Top-Right</option>
              <option value="center-left" ${inst.anchor === 'center-left' ? 'selected' : ''}>Center-Left</option>
              <option value="center" ${inst.anchor === 'center' ? 'selected' : ''}>Center</option>
              <option value="center-right" ${inst.anchor === 'center-right' ? 'selected' : ''}>Center-Right</option>
              <option value="bottom-left" ${inst.anchor === 'bottom-left' ? 'selected' : ''}>Bottom-Left</option>
              <option value="bottom-center" ${inst.anchor === 'bottom-center' ? 'selected' : ''}>Bottom-Center</option>
              <option value="bottom-right" ${inst.anchor === 'bottom-right' ? 'selected' : ''}>Bottom-Right</option>
            </select>
          </div>

          ${
            isSpeed
              ? `
            <div class="control-row">
              <span class="control-label">Speed Unit:</span>
              <select class="select-field speed-unit-select" style="padding: 2px 4px; font-size: 10px;">
                <option value="kph" ${inst.speedUnit !== 'uu/s' ? 'selected' : ''}>km/h</option>
                <option value="uu/s" ${inst.speedUnit === 'uu/s' ? 'selected' : ''}>uu/s</option>
              </select>
            </div>
          `
              : ''
          }

          ${
            isAlign
              ? `
            <div class="control-row">
              <span class="control-label">Alignment:</span>
              <select class="select-field align-select" style="padding: 2px 4px; font-size: 10px;">
                <option value="left" ${inst.textAlign === 'left' ? 'selected' : ''}>Left</option>
                <option value="center" ${inst.textAlign === 'center' ? 'selected' : ''}>Center</option>
                <option value="right" ${inst.textAlign === 'right' || (!inst.textAlign && inst.componentType.includes('right')) ? 'selected' : ''}>Right</option>
              </select>
            </div>
          `
              : ''
          }

          <div class="control-row">
            <label style="font-size: 11px; color: var(--primer-fg-default); cursor: pointer; font-weight: 600;">
              <input type="checkbox" class="aspect-check" ${inst.followAspectRatio ? 'checked' : ''} style="cursor: pointer; margin-right: 4px;">
              Lock Aspect Ratio
            </label>
          </div>

          <div class="custom-props-box" id="props-box-${inst.instanceId}">
          </div>
        </div>
      `;

      // Drawer toggle
      const advBtn = card.querySelector('.toggle-advanced-btn');
      const advDrawer = card.querySelector(`#advanced-drawer-${inst.instanceId}`) as HTMLElement;
      const propsBox = card.querySelector(`#props-box-${inst.instanceId}`) as HTMLElement;

      advBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        advDrawer.classList.toggle('open');
        advBtn.classList.toggle('btn-secondary');
        advBtn.classList.toggle('btn-primary');
      });

      if (propsBox) {
        renderComponentCustomPropsBox(inst, propsBox);
      }

      // Follow Global Checkbox
      const followGlobalCheck = card.querySelector('.follow-global-check') as HTMLInputElement | null;
      followGlobalCheck?.addEventListener('change', () => {
        inst.followGlobal = followGlobalCheck.checked;
        saveCompetitiveLayout(competitiveLayout);
        emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
        if (propsBox) {
          renderComponentCustomPropsBox(inst, propsBox);
        }
      });

      // Selection & hover
      card.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button, select, input, .advanced-drawer')) return;
        selectComponent(inst.instanceId);
      });

      card.addEventListener('mouseenter', () => {
        emitTo('overlay', 'hover-competitive-component', { instanceId: inst.instanceId });
      });

      card.addEventListener('mouseleave', () => {
        emitTo('overlay', 'hover-competitive-component', { instanceId: null });
      });

      // Quick Player Select
      card.querySelector('.player-select')?.addEventListener('change', (e) => {
        inst.targetPlayer = (e.target as HTMLSelectElement).value as TargetPlayer;
        saveCompetitiveLayout(competitiveLayout);
        emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
        renderComponentList();
      });

      // Anchor Select
      card.querySelector('.anchor-select')?.addEventListener('change', (e) => {
        inst.anchor = (e.target as HTMLSelectElement).value as AnchorType;
        saveCompetitiveLayout(competitiveLayout);
        emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
      });

      // Speed Unit Select
      card.querySelector('.speed-unit-select')?.addEventListener('change', (e) => {
        inst.speedUnit = (e.target as HTMLSelectElement).value as SpeedUnit;
        saveCompetitiveLayout(competitiveLayout);
        emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
      });

      // Alignment Select
      card.querySelector('.align-select')?.addEventListener('change', (e) => {
        inst.textAlign = (e.target as HTMLSelectElement).value as TextAlignment;
        saveCompetitiveLayout(competitiveLayout);
        emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
      });

      // Aspect Check
      card.querySelector('.aspect-check')?.addEventListener('change', (e) => {
        inst.followAspectRatio = (e.target as HTMLInputElement).checked;
        saveCompetitiveLayout(competitiveLayout);
        emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
      });

      // Layer Order buttons (operating on true array index origIndex)
      card.querySelector('.btn-top')?.addEventListener('click', (e) => {
        e.stopPropagation();
        competitiveLayout.splice(origIndex, 1);
        competitiveLayout.push(inst);
        saveCompetitiveLayout(competitiveLayout);
        emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
        renderComponentList();
      });

      card.querySelector('.btn-up')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (origIndex < competitiveLayout.length - 1) {
          const temp = competitiveLayout[origIndex + 1];
          competitiveLayout[origIndex + 1] = inst;
          competitiveLayout[origIndex] = temp;
          saveCompetitiveLayout(competitiveLayout);
          emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
          renderComponentList();
        }
      });

      card.querySelector('.btn-down')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (origIndex > 0) {
          const temp = competitiveLayout[origIndex - 1];
          competitiveLayout[origIndex - 1] = inst;
          competitiveLayout[origIndex] = temp;
          saveCompetitiveLayout(competitiveLayout);
          emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
          renderComponentList();
        }
      });

      card.querySelector('.btn-bottom')?.addEventListener('click', (e) => {
        e.stopPropagation();
        competitiveLayout.splice(origIndex, 1);
        competitiveLayout.unshift(inst);
        saveCompetitiveLayout(competitiveLayout);
        emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
        renderComponentList();
      });

      // Delete button
      card.querySelector('.delete-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        competitiveLayout = competitiveLayout.filter((item) => item.instanceId !== inst.instanceId);
        saveCompetitiveLayout(competitiveLayout);
        emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
        if (selectedCompId === inst.instanceId) {
          selectComponent(null);
        }
        renderComponentList();
      });

      compList.appendChild(card);
    });
  }

  function selectComponent(instanceId: string | null) {
    selectedCompId = instanceId;
    emitTo('overlay', 'select-competitive-component', { instanceId });
    if (!compList) return;
    compList.querySelectorAll('.comp-item-card').forEach((card) => {
      if (card.getAttribute('data-id') === instanceId) {
        card.classList.add('selected');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        card.classList.remove('selected');
      }
    });
  }

  // Copy / Export Layout JSON
  copyBtn?.addEventListener('click', async () => {
    try {
      const jsonStr = JSON.stringify(competitiveLayout, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '<span>✅ Copied!</span>';
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
      }, 1500);
    } catch {
      alert('Failed to copy configuration to clipboard.');
    }
  });

  pasteBtn?.addEventListener('click', () => {
    if (importModal && importJsonInput) {
      importJsonInput.value = '';
      importModal.style.display = 'flex';
    }
  });

  cancelImportBtn?.addEventListener('click', () => {
    if (importModal) importModal.style.display = 'none';
  });

  confirmImportBtn?.addEventListener('click', () => {
    if (!importJsonInput) return;
    try {
      const parsed = JSON.parse(importJsonInput.value.trim());
      if (Array.isArray(parsed)) {
        competitiveLayout = parsed;
        saveCompetitiveLayout(competitiveLayout);
        emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
        renderComponentList();
        if (importModal) importModal.style.display = 'none';
      } else {
        alert('Invalid layout JSON format. Expected an array of component instances.');
      }
    } catch {
      alert('Invalid JSON syntax.');
    }
  });

  resetBtn?.addEventListener('click', () => {
    if (confirm('Reset competitive layout to default preset? This will discard your custom layout.')) {
      competitiveLayout = getDefaultCompetitiveLayout();
      saveCompetitiveLayout(competitiveLayout);
      emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
      renderComponentList();
    }
  });

  // Listen for updates from Overlay (e.g. dragging or selecting on overlay canvas)
  listen<{ layout: ComponentInstance[] }>('layout-updated-from-overlay', (event) => {
    competitiveLayout = event.payload.layout;
    saveCompetitiveLayout(competitiveLayout);
    renderComponentList();
  });

  listen<{ instanceId: string | null }>('component-selected-from-overlay', (event) => {
    selectedCompId = event.payload.instanceId;
    if (!compList) return;
    compList.querySelectorAll('.comp-item-card').forEach((card) => {
      if (card.getAttribute('data-id') === selectedCompId) {
        card.classList.add('selected');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        card.classList.remove('selected');
      }
    });
  });

  renderComponentList();
}
