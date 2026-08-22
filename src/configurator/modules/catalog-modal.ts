import {
  COMPONENT_METAS,
  getAllComponentMetas,
  createComponentInnerHtml,
  updateComponentInstanceDom
} from '../../overlay/core/component-registry';
import { createNewComponentInstance } from '../../overlay/core/layout-store';
import { TelemetryBuffer, DEFAULT_TEAM_COLORS, ComponentInstance } from '../../overlay/core/component-types';
import { matchesRegexOrQuery } from './ui-controls';

/**
 * ============================================================================
 * 🧩 Component Catalog Modal & Live Previewer
 * ============================================================================
 */

export function initCatalogModal(
  onInsertComponent: (instance: ComponentInstance) => void
): void {
  const btnOpenCatalog = document.getElementById('btn-open-catalog');
  const catalogModal = document.getElementById('catalog-modal');
  const btnCloseCatalog = document.getElementById('btn-close-catalog');
  const catalogSearchInput = document.getElementById('catalog-search-input') as HTMLInputElement | null;
  const catalogTierSelect = document.getElementById('catalog-tier-select') as HTMLSelectElement | null;
  const catalogItemList = document.getElementById('catalog-item-list');
  const catalogMount = document.getElementById('catalog-mount');
  const catalogPreviewTitle = document.getElementById('catalog-preview-title');
  const catalogInsertBtn = document.getElementById('catalog-insert-btn');

  const catalogSimBoost = document.getElementById('catalog-sim-boost') as HTMLInputElement | null;
  const catalogSimBoostVal = document.getElementById('catalog-sim-boost-val');
  const catalogSimSpeed = document.getElementById('catalog-sim-speed') as HTMLInputElement | null;
  const catalogSimSpeedVal = document.getElementById('catalog-sim-speed-val');

  let catalogSelectedCompId: string = 'element-boost-text';

  const catalogTelemetry: TelemetryBuffer = {
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
    p1Name: 'steamuser',
    p1Speed: 1600,
    p1Boost: 85,
    p1HasCar: true,
    p1Boosting: false,
    p1OnGround: true,
    p1OnWall: false,
    p1Powersliding: false,
    p1Demolished: false,
    p1Supersonic: false,
    p2Name: 'Fury',
    p2Speed: 800,
    p2Boost: 50,
    p2HasCar: true,
    p2Boosting: false,
    p2OnGround: true,
    p2OnWall: false,
    p2Powersliding: false,
    p2Demolished: false,
    p2Supersonic: false,
    p3Name: 'Khan',
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

  const catalogPreviewWrapper = document.getElementById('catalog-preview-wrapper') as HTMLElement | null;
  const catalogDraggerFrame = document.getElementById('catalog-dragger-frame') as HTMLElement | null;

  function renderCatalogPreview() {
    if (!catalogMount || !catalogPreviewTitle) return;
    const meta = COMPONENT_METAS[catalogSelectedCompId];
    if (!meta) return;

    catalogPreviewTitle.textContent = `Previewing: ${meta.displayName} (${meta.id})`;

    const dummyInst = createNewComponentInstance(
      meta.id,
      'p1',
      'kph',
      meta.supportsAlignment ? 'center' : 'right',
      true,
      'center'
    );

    const baseW = meta.baseWidthPx || 200;
    const baseH = meta.baseHeightPx || 60;

    let previewW = catalogPreviewWrapper?.clientWidth;
    let previewH = catalogPreviewWrapper?.clientHeight;
    if (!previewW || !previewH || previewW === 0) {
      previewW = Math.min(280, Math.max(60, baseW));
      previewH = Math.min(160, Math.max(30, baseH));
      if (catalogPreviewWrapper) {
        catalogPreviewWrapper.style.width = `${previewW}px`;
        catalogPreviewWrapper.style.height = `${previewH}px`;
      }
    }

    catalogMount.innerHTML = `
      <div class="comp-inner ${meta.isProportional ? 'comp-proportional' : 'comp-flexible'}">
        ${createComponentInnerHtml(dummyInst)}
      </div>
    `;

    if (meta.isProportional) {
      const inner = catalogMount.querySelector('.comp-proportional') as HTMLElement | null;
      if (inner) {
        const scale = Math.min(previewW / baseW, previewH / baseH);
        inner.style.width = `${baseW}px`;
        inner.style.height = `${baseH}px`;
        inner.style.transform = `scale(${scale.toFixed(4)})`;
        inner.style.transformOrigin = 'center center';
      }
    }

    updateComponentInstanceDom(catalogMount, dummyInst, catalogTelemetry);
  }

  // 8-Point Dragger Resizer in Catalog Modal
  let isCatalogDragging = false;
  let catalogDragHandle: string | null = null;
  let catalogStartX = 0;
  let catalogStartY = 0;
  let catalogStartW = 200;
  let catalogStartH = 60;

  catalogDraggerFrame?.addEventListener('pointerdown', (e) => {
    const target = (e.target as HTMLElement).closest('.dragger-handle');
    if (!target) return;
    const handle = target.getAttribute('data-handle');
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

  window.addEventListener('pointermove', (e) => {
    if (!isCatalogDragging || !catalogDragHandle || !catalogPreviewWrapper) return;
    const deltaX = e.clientX - catalogStartX;
    const deltaY = e.clientY - catalogStartY;
    let newW = catalogStartW;
    let newH = catalogStartH;

    if (catalogDragHandle.includes('e')) newW = catalogStartW + deltaX;
    if (catalogDragHandle.includes('w')) newW = catalogStartW - deltaX;
    if (catalogDragHandle.includes('s')) newH = catalogStartH + deltaY;
    if (catalogDragHandle.includes('n')) newH = catalogStartH - deltaY;

    newW = Math.max(40, Math.min(480, newW));
    newH = Math.max(20, Math.min(280, newH));

    catalogPreviewWrapper.style.width = `${newW}px`;
    catalogPreviewWrapper.style.height = `${newH}px`;
    renderCatalogPreview();
  });

  window.addEventListener('pointerup', () => {
    isCatalogDragging = false;
    catalogDragHandle = null;
  });

  function renderCatalogList() {
    if (!catalogItemList) return;
    catalogItemList.innerHTML = '';

    const tier = catalogTierSelect?.value || 'all';
    const query = catalogSearchInput?.value || '';

    const allMetas = getAllComponentMetas();
    const filtered = allMetas.filter((meta) => {
      const matchTier = tier === 'all' || meta.tier === tier;
      const matchQuery = matchesRegexOrQuery(`${meta.displayName} ${meta.id}`, query);
      return matchTier && matchQuery;
    });

    if (filtered.length === 0) {
      catalogItemList.innerHTML = '<div style="font-size: 11px; color: var(--primer-fg-muted); padding: 8px;">No matching components found.</div>';
      return;
    }

    filtered.forEach((meta) => {
      const item = document.createElement('div');
      item.className = `catalog-item ${meta.id === catalogSelectedCompId ? 'selected' : ''}`;
      item.setAttribute('data-id', meta.id);

      const tierBadge = meta.tier === 'element'
        ? '<span class="comp-type-tag" style="background: #8250df;">ELEMENT</span>'
        : meta.tier === 'panel'
        ? '<span class="comp-type-tag" style="background: #0969da;">PANEL</span>'
        : '<span class="comp-type-tag" style="background: #1f883d;">WIDGET</span>';

      const catBadge = meta.category === 'player'
        ? '<span class="comp-type-tag" style="background: #bc4c00;">PLAYER</span>'
        : '<span class="comp-type-tag" style="background: #656d76;">GLOBAL</span>';

      item.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
          <span style="font-weight: bold; color: var(--primer-fg-default);">${meta.displayName}</span>
          <div style="display: flex; gap: 4px;">
            ${tierBadge}
            ${catBadge}
          </div>
        </div>
        <div style="font-size: 10px; color: var(--primer-fg-muted);">${meta.id}</div>
      `;

      item.addEventListener('click', () => {
        catalogItemList.querySelectorAll('.catalog-item').forEach((it) => it.classList.remove('selected'));
        item.classList.add('selected');
        catalogSelectedCompId = meta.id;

        if (catalogPreviewWrapper) {
          const baseW = meta.baseWidthPx || 200;
          const baseH = meta.baseHeightPx || 60;
          catalogPreviewWrapper.style.width = `${Math.min(280, Math.max(60, baseW))}px`;
          catalogPreviewWrapper.style.height = `${Math.min(160, Math.max(30, baseH))}px`;
        }

        renderCatalogPreview();
      });

      catalogItemList.appendChild(item);
    });
  }

  catalogSimBoost?.addEventListener('input', () => {
    const val = parseInt(catalogSimBoost.value, 10);
    if (catalogSimBoostVal) catalogSimBoostVal.textContent = val.toString();
    catalogTelemetry.p1Boost = val;
    renderCatalogPreview();
  });

  catalogSimSpeed?.addEventListener('input', () => {
    const val = parseInt(catalogSimSpeed.value, 10);
    if (catalogSimSpeedVal) catalogSimSpeedVal.textContent = val.toString();
    catalogTelemetry.p1Speed = val;
    renderCatalogPreview();
  });

  catalogSearchInput?.addEventListener('input', renderCatalogList);
  catalogTierSelect?.addEventListener('change', renderCatalogList);

  btnOpenCatalog?.addEventListener('click', () => {
    if (catalogModal) catalogModal.style.display = 'flex';
    renderCatalogList();
    renderCatalogPreview();
  });

  btnCloseCatalog?.addEventListener('click', () => {
    if (catalogModal) catalogModal.style.display = 'none';
  });

  catalogInsertBtn?.addEventListener('click', () => {
    const meta = COMPONENT_METAS[catalogSelectedCompId];
    if (!meta) return;

    const newInst = createNewComponentInstance(
      meta.id,
      'p1',
      'kph',
      'right',
      meta.isProportional,
      'center'
    );

    onInsertComponent(newInst);

    if (catalogModal) catalogModal.style.display = 'none';
  });
}
