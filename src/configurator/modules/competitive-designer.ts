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
      15,
      1,
      globalLayoutSettings.strokeWidth,
      'px',
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
      25,
      1,
      globalLayoutSettings.cardBorderRadius ?? globalLayoutSettings.bgRadius ?? 0,
      'px',
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
        25,
        1,
        inst.customProps?.bgRadius !== undefined ? Number(inst.customProps.bgRadius) : (inst.customProps?.borderRadius !== undefined ? Number(inst.customProps.borderRadius) : 0),
        'px',
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
          15,
          1,
          inst.customProps?.strokeWidth !== undefined ? Number(inst.customProps.strokeWidth) : 0,
          'px',
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
        createSliderControl('Border Width', 1, 8, 1, Number(inst.customProps?.borderWidth ?? 2), 'px', (val) => {
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
        createSliderControl('Arc Gap Angle (Degrees)', 0, 180, 5, Number(inst.customProps?.gap ?? 90), '°', (val) => {
          inst.customProps!.gap = val;
          saveAndEmit();
        })
      );
      propsBox.appendChild(
        createSliderControl('Gauge Thickness (px)', 2, 20, 1, Number(inst.customProps?.thickness ?? 8), 'px', (val) => {
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
      propsBox.appendChild(
        createColorModeControl(
          'Active Color Mode',
          inst.customProps?.activeColorMode as ColorSource,
          inst.customProps?.activeColor,
          '#30d158',
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
  }

  function renderComponentList() {
    if (!compList) return;
    compList.innerHTML = '';

    competitiveLayout.forEach((inst, index) => {
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

      const isPlayer = inst.category === 'player' || meta.category === 'player' || Boolean(inst.targetPlayer);
      const isSpeed = meta.supportsSpeedUnit === true || inst.componentType.includes('speed');
      const isAlign = meta.supportsAlignment === true || inst.componentType.includes('text');

      const tierBadge = meta.tier === 'element'
        ? '<span class=\"comp-type-tag\" style=\"background: #8250df;\">ELEMENT</span>'
        : meta.tier === 'panel'
        ? '<span class=\"comp-type-tag\" style=\"background: #0969da;\">PANEL</span>'
        : '<span class=\"comp-type-tag\" style=\"background: #1f883d;\">WIDGET</span>';

      const playerBadge = isPlayer
        ? `<span class=\"comp-type-tag\" style=\"background: #bc4c00;\">${(inst.targetPlayer || 'p1').toUpperCase()}</span>`
        : '<span class=\"comp-type-tag\" style=\"background: #656d76;\">GLOBAL</span>';

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

      // Layer Order buttons
      card.querySelector('.btn-top')?.addEventListener('click', (e) => {
        e.stopPropagation();
        competitiveLayout.splice(index, 1);
        competitiveLayout.push(inst);
        saveCompetitiveLayout(competitiveLayout);
        emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
        renderComponentList();
      });

      card.querySelector('.btn-up')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (index < competitiveLayout.length - 1) {
          const temp = competitiveLayout[index + 1];
          competitiveLayout[index + 1] = inst;
          competitiveLayout[index] = temp;
          saveCompetitiveLayout(competitiveLayout);
          emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
          renderComponentList();
        }
      });

      card.querySelector('.btn-down')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (index > 0) {
          const temp = competitiveLayout[index - 1];
          competitiveLayout[index - 1] = inst;
          competitiveLayout[index] = temp;
          saveCompetitiveLayout(competitiveLayout);
          emitTo('overlay', 'update-competitive-layout', { layout: competitiveLayout });
          renderComponentList();
        }
      });

      card.querySelector('.btn-bottom')?.addEventListener('click', (e) => {
        e.stopPropagation();
        competitiveLayout.splice(index, 1);
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
