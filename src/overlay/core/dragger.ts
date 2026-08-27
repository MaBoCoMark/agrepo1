import { ComponentInstance } from './component-types';
import { COMPONENT_METAS } from './component-registry';
import {
  getScreenHeightVw,
  calculateElementTopLeft,
  calculateOffsetFromTopLeft
} from './layout-store';

export class DraggerController {
  private overlayRoot: HTMLElement;
  private selectedInstanceId: string | null = null;
  private instances: ComponentInstance[] = [];
  private draggerEl: HTMLElement | null = null;
  private isDragging = false;
  private dragMode: 'move' | 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se' | null = null;
  private startPointerX = 0;
  private startPointerY = 0;
  private startLeftVw = 0;
  private startTopVw = 0;
  private startWidthVw = 0;
  private startHeightVw = 0;
  private onLayoutChangeCallback: ((layout: ComponentInstance[]) => void) | null = null;
  private onSelectCallback: ((instanceId: string | null) => void) | null = null;

  constructor(overlayRoot: HTMLElement) {
    this.overlayRoot = overlayRoot;
    this.createDraggerDom();
    this.bindGlobalEvents();
  }

  public setInstances(instances: ComponentInstance[]) {
    this.instances = instances;
    this.updateDraggerPosition();
  }

  public onLayoutChange(cb: (layout: ComponentInstance[]) => void) {
    this.onLayoutChangeCallback = cb;
  }

  public onSelect(cb: (instanceId: string | null) => void) {
    this.onSelectCallback = cb;
  }

  public selectInstance(instanceId: string | null) {
    this.selectedInstanceId = instanceId;
    this.updateDraggerPosition();
    if (this.onSelectCallback) {
      this.onSelectCallback(instanceId);
    }
  }

  public getSelectedInstanceId(): string | null {
    return this.selectedInstanceId;
  }

  public updateProportionalScale(container: HTMLElement, inst: ComponentInstance) {
    const meta = COMPONENT_METAS[inst.componentType];
    if (!meta || !meta.isProportional) return;

    const inner = container.querySelector('.comp-proportional') as HTMLElement | null;
    if (!inner) return;

    const baseW = meta.baseWidthPx ?? 100;
    const baseH = meta.baseHeightPx ?? 100;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    if (containerW <= 0 || containerH <= 0 || baseW <= 0 || baseH <= 0) return;

    const scale = Math.min(containerW / baseW, containerH / baseH);
    inner.style.width = `${baseW}px`;
    inner.style.height = `${baseH}px`;
    inner.style.flexShrink = '0';
    inner.style.transform = `scale(${scale.toFixed(4)})`;
    inner.style.transformOrigin = 'center center';
  }

  private createDraggerDom() {
    this.draggerEl = document.createElement('div');
    this.draggerEl.className = 'dragger-overlay';
    this.draggerEl.style.display = 'none';

    this.draggerEl.innerHTML = `
      <div class="dragger-body" data-handle="move">
        <div class="dragger-crosshair"></div>
      </div>
      <div class="dragger-handle handle-nw" data-handle="nw"></div>
      <div class="dragger-handle handle-n" data-handle="n"></div>
      <div class="dragger-handle handle-ne" data-handle="ne"></div>
      <div class="dragger-handle handle-e" data-handle="e"></div>
      <div class="dragger-handle handle-se" data-handle="se"></div>
      <div class="dragger-handle handle-s" data-handle="s"></div>
      <div class="dragger-handle handle-sw" data-handle="sw"></div>
      <div class="dragger-handle handle-w" data-handle="w"></div>
    `;

    this.overlayRoot.appendChild(this.draggerEl);

    this.draggerEl.addEventListener('pointerdown', (e) => {
      const target = (e.target as HTMLElement).closest('[data-handle]') as HTMLElement | null;
      if (!target) return;
      e.stopPropagation();
      e.preventDefault();

      const handle = target.getAttribute('data-handle') as any;
      this.startDrag(handle, e.clientX, e.clientY);
    });
  }

  public updateDraggerPosition() {
    if (!this.draggerEl) return;
    if (!this.selectedInstanceId) {
      this.draggerEl.style.display = 'none';
      return;
    }

    const inst = this.instances.find((i) => i.instanceId === this.selectedInstanceId);
    if (!inst) {
      this.draggerEl.style.display = 'none';
      return;
    }

    const screenH = getScreenHeightVw();
    const { leftVw, topVw } = calculateElementTopLeft(inst, screenH);

    this.draggerEl.style.display = 'block';
    this.draggerEl.style.left = `${leftVw}vw`;
    this.draggerEl.style.top = `${topVw}vw`;
    this.draggerEl.style.width = `${inst.widthVw}vw`;
    this.draggerEl.style.height = `${inst.heightVw}vw`;
  }

  private startDrag(mode: 'move' | 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se', clientX: number, clientY: number) {
    const inst = this.instances.find((i) => i.instanceId === this.selectedInstanceId);
    if (!inst) return;

    this.isDragging = true;
    this.dragMode = mode;
    this.startPointerX = clientX;
    this.startPointerY = clientY;

    const screenH = getScreenHeightVw();
    const { leftVw, topVw } = calculateElementTopLeft(inst, screenH);

    this.startLeftVw = leftVw;
    this.startTopVw = topVw;
    this.startWidthVw = inst.widthVw;
    this.startHeightVw = inst.heightVw;
  }

  private bindGlobalEvents() {
    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging || !this.dragMode || !this.selectedInstanceId) return;

      const inst = this.instances.find((i) => i.instanceId === this.selectedInstanceId);
      if (!inst) return;

      const vwPx = window.innerWidth / 100;
      const deltaXvw = (e.clientX - this.startPointerX) / vwPx;
      const deltaYvw = (e.clientY - this.startPointerY) / vwPx;
      const screenH = getScreenHeightVw();
      const meta = COMPONENT_METAS[inst.componentType];
      const minW = meta?.minWidthVw || 2;
      const minH = meta?.minHeightVw || 1;

      let curLeftVw = this.startLeftVw;
      let curTopVw = this.startTopVw;
      let curWidthVw = this.startWidthVw;
      let curHeightVw = this.startHeightVw;

      if (this.dragMode === 'move') {
        curLeftVw += deltaXvw;
        curTopVw += deltaYvw;
      } else {
        // 8-Point Controlling Points Resizing
        if (this.dragMode.includes('e')) {
          curWidthVw = Math.max(minW, this.startWidthVw + deltaXvw);
        }
        if (this.dragMode.includes('w')) {
          const newW = Math.max(minW, this.startWidthVw - deltaXvw);
          curLeftVw = this.startLeftVw + (this.startWidthVw - newW);
          curWidthVw = newW;
        }
        if (this.dragMode.includes('s')) {
          curHeightVw = Math.max(minH, this.startHeightVw + deltaYvw);
        }
        if (this.dragMode.includes('n')) {
          const newH = Math.max(minH, this.startHeightVw - deltaYvw);
          curTopVw = this.startTopVw + (this.startHeightVw - newH);
          curHeightVw = newH;
        }

        // Follow / Lock Original Aspect Ratio if enabled
        if (inst.followAspectRatio) {
          const baseRatio = (this.startWidthVw / this.startHeightVw) || (meta && meta.baseWidthPx && meta.baseHeightPx ? meta.baseWidthPx / meta.baseHeightPx : 1);
          if (this.dragMode.includes('e') || this.dragMode.includes('w')) {
            const adjustedH = curWidthVw / baseRatio;
            if (this.dragMode.includes('n')) {
              curTopVw = this.startTopVw + (this.startHeightVw - adjustedH);
            }
            curHeightVw = adjustedH;
          } else if (this.dragMode.includes('s') || this.dragMode.includes('n')) {
            const adjustedW = curHeightVw * baseRatio;
            if (this.dragMode.includes('w')) {
              curLeftVw = this.startLeftVw + (this.startWidthVw - adjustedW);
            }
            curWidthVw = adjustedW;
          }
        }
      }

      curWidthVw = parseFloat(curWidthVw.toFixed(2));
      curHeightVw = parseFloat(curHeightVw.toFixed(2));

      // Recalculate anchor offset
      const { offsetXvw, offsetYvw } = calculateOffsetFromTopLeft(
        inst.anchor,
        curLeftVw,
        curTopVw,
        curWidthVw,
        curHeightVw,
        screenH
      );

      inst.widthVw = curWidthVw;
      inst.heightVw = curHeightVw;
      inst.offsetXvw = offsetXvw;
      inst.offsetYvw = offsetYvw;

      // Update DOM element directly
      const compDom = this.overlayRoot.querySelector(`[data-instance-id="${inst.instanceId}"]`) as HTMLElement | null;
      if (compDom) {
        compDom.style.left = `${curLeftVw}vw`;
        compDom.style.top = `${curTopVw}vw`;
        compDom.style.width = `${curWidthVw}vw`;
        compDom.style.height = `${curHeightVw}vw`;
        this.updateProportionalScale(compDom, inst);
      }

      this.updateDraggerPosition();
    });

    window.addEventListener('pointerup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.dragMode = null;
        if (this.onLayoutChangeCallback) {
          this.onLayoutChangeCallback(this.instances);
        }
      }
    });

    // Clicking canvas background deselects
    window.addEventListener('pointerdown', (e) => {
      const clickedComp = (e.target as HTMLElement).closest('.comp-container');
      const clickedDragger = (e.target as HTMLElement).closest('.dragger-overlay');
      if (!clickedComp && !clickedDragger) {
        this.selectInstance(null);
      }
    });
  }
}
