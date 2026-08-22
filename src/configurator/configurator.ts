import { initThemeController } from './modules/theme-controller';
import { initOverlayMonitor } from './modules/overlay-monitor';
import { initCanvasBackgroundControls } from './modules/canvas-bg-controller';
import { initWebSocketControls } from './modules/ws-controller';
import { initPacketInspector } from './modules/packet-inspector';
import { initCatalogModal } from './modules/catalog-modal';
import { initRefSceneController } from './modules/ref-scene-controller';
import { initCompetitiveDesigner } from './modules/competitive-designer';
import { initBenchmarkTool } from './modules/benchmark-tool';
import { ComponentInstance } from '../overlay/core/component-types';

/**
 * ============================================================================
 * 🛠️ Configurator Application Entry Point
 * ============================================================================
 *
 * Fully modularized architecture:
 * - Theme controller
 * - Overlay monitor & canvas background controls
 * - Reference & Scene layer switcher
 * - WebSocket connection & Mock simulation stream
 * - Packet Inspector & Event filter manager
 * - Component Catalog & Live Previewer modal
 * - Competitive Scene Visual Layout Designer & 8-point draggers
 * - Performance Benchmark Engine & Frametime Charting
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme Controller (Light / Dark mode)
  initThemeController();

  // 2. Overlay Monitor (Resolution & Scale tracker)
  void initOverlayMonitor();

  // 3. Canvas Background Controls (Transparent vs Solid Chroma Key)
  initCanvasBackgroundControls();

  // 4. WebSocket & Simulation Controls
  initWebSocketControls();

  // 5. Packet Inspector
  initPacketInspector();

  // 6. Reference & Scene Layer Switcher & Tuning Sliders
  initRefSceneController();

  // Shared callback ref for inserting components from Catalog Modal into Competitive Designer
  const onInsertCallbackRef: { fn: ((inst: ComponentInstance) => void) | null } = { fn: null };

  // 7. Competitive Visual Layout Designer
  initCompetitiveDesigner(onInsertCallbackRef);

  // 8. Built-in Component Catalog Modal & Previewer
  initCatalogModal((inst) => {
    if (onInsertCallbackRef.fn) {
      onInsertCallbackRef.fn(inst);
    }
  });

  // 9. Performance Benchmark Tool (10s RAF timing & Charting)
  initBenchmarkTool();
});
