import { emitTo } from '@tauri-apps/api/event';
import { getMergedManifest } from './config-loader';
import { ComponentInstance } from './component-types';
import { loadCompetitiveLayout, saveCompetitiveLayout } from './layout-store';
import { DraggerController } from './dragger';
import { overlayState, setOverlayClickThrough, resetPreviousData } from './telemetry-state';
import { cacheDevDashboardNodes, buildCompetitiveDomCache } from './dom-cache';
import { updateReplayViewerDOM, updateReplaySvgBorder, registerSceneSwitcher } from './replay-controller';
import { cacheBallHitNodes, markBallHitDirty, renderBallHitScene } from './ball-hit-tracker';

/**
 * ============================================================================
 * 🖼️ Scene & Reference Layer Manager
 * ============================================================================
 */

export const spawnedRefs = new Map<string, HTMLElement>();
export const spawnedScenes = new Map<string, HTMLElement>();
export const manifest = getMergedManifest();

let competitiveInstances: ComponentInstance[] = [];
let dragger: DraggerController | null = null;
let refCanvasEl: HTMLDivElement | null = null;
let sceneCanvasEl: HTMLDivElement | null = null;

// Eagerly import HTML templates via Vite
const sceneHtmlModules = import.meta.glob('../scenes/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true
});

const refHtmlModules = import.meta.glob('../references/**/*.html', {
  query: '?raw',
  import: 'default',
  eager: true
});

function getSceneHtml(filePath: string): string {
  if (!filePath) return '';
  const fileName = filePath.split('/').pop() || '';
  const key = `../scenes/${fileName}`;
  const raw = sceneHtmlModules[key];
  if (!raw) return '';
  return typeof raw === 'string' ? raw : (raw && typeof (raw as any).default === 'string' ? (raw as any).default : String(raw || ''));
}

function getReferenceHtml(filePath: string): string {
  if (!filePath) return '';
  const fileName = filePath.split('/').pop() || '';
  const key = `../references/${fileName}`;
  const raw = refHtmlModules[key];
  if (!raw) return '';
  return typeof raw === 'string' ? raw : (raw && typeof (raw as any).default === 'string' ? (raw as any).default : String(raw || ''));
}

export function getDragger(): DraggerController | null {
  return dragger;
}

export function getCompetitiveInstances(): ComponentInstance[] {
  return competitiveInstances;
}

export function setCompetitiveInstances(instances: ComponentInstance[]): void {
  competitiveInstances = instances;
}

export function renderCompetitiveScene(instances: ComponentInstance[]): void {
  const root = document.getElementById('competitive-root');
  if (!root) return;
  buildCompetitiveDomCache(instances, root, dragger, overlayState.isLayoutEditing);
}

export async function loadLayers(): Promise<void> {
  refCanvasEl = document.getElementById('reference-canvas') as HTMLDivElement;
  sceneCanvasEl = document.getElementById('scene-canvas') as HTMLDivElement;

  try {
    if (refCanvasEl) {
      for (const item of manifest.references) {
        const layer = document.createElement('div');
        layer.style.position = 'absolute';
        layer.style.top = '0';
        layer.style.left = '0';
        layer.style.display = 'none';
        if (item.file) {
          layer.innerHTML = getReferenceHtml(item.file);
        }
        refCanvasEl.appendChild(layer);
        spawnedRefs.set(item.id, layer);
      }
    }

    if (sceneCanvasEl) {
      for (const item of manifest.scenes) {
        const layer = document.createElement('div');
        layer.style.position = 'absolute';
        layer.style.top = '0';
        layer.style.left = '0';
        layer.style.width = '100%';
        layer.style.height = '100%';
        layer.style.display = 'none';
        if (item.file) {
          layer.innerHTML = getSceneHtml(item.file);
        }
        sceneCanvasEl.appendChild(layer);
        spawnedScenes.set(item.id, layer);
      }
    }

    cacheDevDashboardNodes();
    cacheBallHitNodes();
    updateReplayViewerDOM();
    updateReplaySvgBorder();

    // Competitive setup
    competitiveInstances = loadCompetitiveLayout();
    const compScene = spawnedScenes.get('competitive');
    if (compScene) {
      dragger = new DraggerController(compScene);
      dragger.onLayoutChange((updatedLayout) => {
        competitiveInstances = updatedLayout;
        saveCompetitiveLayout(updatedLayout);
        emitTo('configurator', 'layout-updated-from-overlay', { layout: updatedLayout });
      });
      dragger.onSelect((instanceId) => {
        emitTo('configurator', 'component-selected-from-overlay', { instanceId });
      });
      renderCompetitiveScene(competitiveInstances);
    }
  } catch (err) {
    console.error('Error during loadLayers in overlay:', err);
  }
}

export function switchRefMode(target: string): void {
  spawnedRefs.forEach((layer, id) => {
    layer.style.display = id === target ? 'block' : 'none';
  });
  updateDimensions();
}

export function switchSceneMode(target: string, notifyConfigurator: boolean = false): void {
  overlayState.currentActiveScene = target;
  spawnedScenes.forEach((layer, id) => {
    const isTarget = (id === target) || (target === 'developer-dashboard' && id === 'live-replay') || (target === 'live-replay' && id === 'developer-dashboard');
    layer.style.display = isTarget ? 'block' : 'none';
  });
  overlayState.isDevDashboardVisible = (target === 'developer-dashboard' || target === 'live-replay');
  overlayState.isCompetitiveVisible = (target === 'competitive');
  overlayState.isBallHitVisible = (target === 'ball-hit');

  if (target !== 'competitive') {
    if (overlayState.isLayoutEditing) {
      overlayState.isLayoutEditing = false;
      document.body.classList.remove('layout-editing');
      dragger?.selectInstance(null);
      void setOverlayClickThrough(true);
    }
  }

  if (overlayState.isDevDashboardVisible) {
    resetPreviousData();
  }

  if (overlayState.isBallHitVisible) {
    markBallHitDirty();
    renderBallHitScene();
  }

  if (target === 'replay-viewer') {
    updateReplayViewerDOM();
    updateReplaySvgBorder();
  }

  if (overlayState.isCompetitiveVisible) {
    renderCompetitiveScene(competitiveInstances);
  }

  if (notifyConfigurator) {
    emitTo('configurator', 'scene-auto-switched', { scene: target });
  }
}

export function updateDimensions(): void {
  const scale = window.devicePixelRatio;
  const lWidth = window.innerWidth;
  const lHeight = window.innerHeight;
  spawnedRefs.forEach((layer, id) => {
    if (layer.style.display !== 'none') {
      if (id === '1080p') {
        layer.style.width = `${1920 / scale}px`;
        layer.style.height = `${1080 / scale}px`;
      } else if (id === '1440p') {
        layer.style.width = `${2560 / scale}px`;
        layer.style.height = `${1440 / scale}px`;
      } else if (id === '1600p') {
        layer.style.width = `${2560 / scale}px`;
        layer.style.height = `${1600 / scale}px`;
      }
    }
  });

  updateReplaySvgBorder();

  if (overlayState.isCompetitiveVisible && dragger) {
    renderCompetitiveScene(competitiveInstances);
  }

  emitTo('configurator', 'overlay-metrics', [Math.round(lWidth * scale), Math.round(lHeight * scale), scale, lWidth, lHeight]);
}

// Register scene switcher with replay controller
registerSceneSwitcher(switchSceneMode);
