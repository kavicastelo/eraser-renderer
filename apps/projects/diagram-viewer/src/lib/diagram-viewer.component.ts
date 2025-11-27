import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { parseEraserDSL, DiagramAST } from '@eraser/core';
import {computeDiagramLayout, renderToSVGElement, ViewerRenderOptions} from '@eraser/viewer';
import { DOCUMENT, isPlatformBrowser, NgIf } from '@angular/common';

export type DiagramTheme = 'light' | 'dark';

export interface DiagramViewerEvent {
  ast?: DiagramAST;
  svg?: SVGSVGElement;
  error?: string;
}

@Component({
  selector: 'diagram-viewer',
  template: `
    <div class="diagram-viewer-root" [class.dark]="theme === 'dark'">
      <div class="toolbar" *ngIf="showToolbar">
        <button (click)="fitToView()" title="Fit to view">Fit</button>
        <button (click)="zoomIn()" title="Zoom In">+</button>
        <button (click)="zoomOut()" title="Zoom Out">-</button>
        <button (click)="resetView()" title="Reset">Reset</button>
      </div>

      <div class="title" *ngIf="diagramTitle">{{diagramTitle}}</div>
      <div #host class="svg-host" aria-live="polite"></div>

      <div *ngIf="error" class="error">
        <strong>Render error:</strong>
        <pre>{{ error }}</pre>
      </div>
    </div>
  `,
  styles: [`
      .diagram-viewer-root {
        width: 100%;
        height: 100%;
        min-height: calc(100vh - 40px);
        background: var(--viewer-bg);
        color: var(--viewer-fg);
        position: relative;
        overflow: hidden;
        border-radius: 12px;
      }

      .title {
        color: var(--viewer-fg);
        position: absolute;
        top: 8px;
        left: 16px;
        font-size: 14px;
        font-weight: 500;
        z-index: 100;
      }

      .svg-host {
        width: 100%;
        height: 100%;
        background: var(--viewer-bg);
      }

      .toolbar {
        position: absolute;
        top: 32px;
        right: 12px;
        z-index: 100;
        background: var(--toolbar-bg);
        backdrop-filter: blur(8px);
        padding: 8px;
        border-radius: 12px;
        display: flex;
        gap: 8px;
        box-shadow: var(--toolbar-shadow);
        font-size: 13px;
      }

      .toolbar button {
        padding: 6px 10px;
        border: none;
        background: #0066ff;
        color: white;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        font-size: 12px;
      }

      .toolbar button:hover {
        background: #0052cc;
      }

      .error {
        position: absolute;
        bottom: 16px;
        left: 16px;
        right: 16px;
        background: rgba(255, 100, 100, 0.15);
        color: #c62828;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid #ffcdd2;
        z-index: 100;
        backdrop-filter: blur(4px);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf],
  standalone: true,
})
export class DiagramViewerComponent
  implements OnChanges, AfterViewInit, OnDestroy
{
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  @Input() code?: string;
  @Input() ast?: DiagramAST;
  @Input() theme: DiagramTheme = 'light';
  @Input() showToolbar = true;
  @Input() fitOnLoad = true;

  @Output() loaded = new EventEmitter<DiagramViewerEvent>();
  @Output() zoomChange = new EventEmitter<number>();

  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  error?: string;

  // Internal State
  private currentSvg?: SVGSVGElement | null;
  private panZoomInstance?: any;
  private panZoomLib: any;
  public diagramTitle?: string; // Set by metadata

  get isBrowser() {
    return isPlatformBrowser(this.platformId);
  }

  async ngAfterViewInit() {
    if (!this.isBrowser) return;
    // Load library once
    if (!this.panZoomLib) {
      this.panZoomLib = (await import('svg-pan-zoom')).default;
    }
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isBrowser) return;

    // If code or ast changed, full re-render
    if (changes['code'] || changes['ast']) {
      this.render();
    }

    // If only theme changed, just apply styles (cheaper)
    if (changes['theme'] && !changes['theme'].firstChange) {
      this.applyTheme();
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.destroyPanZoom();
  }

  /**
   * Main Render Loop
   */
  private render() {
    if (!this.isBrowser || !this.panZoomLib) return;

    this.ngZone.runOutsideAngular(() => {
      try {
        // 1. Clean up previous
        this.destroyPanZoom();
        this.clearHost();
        this.error = undefined;

        // 2. Parse / Compute
        const ast = this.ast ?? (this.code ? parseEraserDSL(this.code) : null);
        if (!ast) {
          this.emitState({ error: 'No content' });
          return;
        }

        const layout = computeDiagramLayout(ast); // Optional: use for specific sizing logic

        let options: ViewerRenderOptions = { theme: this.theme, shadow: true };
        const result = renderToSVGElement(ast, options);
        if (!result.svg) throw new Error('Failed to render SVG');
        this.diagramTitle = ast.metadata['title'] as string;

        // 3. Update DOM
        this.ngZone.run(() => {
          const svg = result.svg;
          // Set basic sizing for the container
          svg.setAttribute('width', '100%');
          svg.setAttribute('height', '100%');

          this.hostRef.nativeElement.appendChild(svg);
          this.currentSvg = svg;

          this.applyTheme();
          this.initPanZoom(svg);

          this.emitState({ ast, svg });
        });

      } catch (err: any) {
        this.ngZone.run(() => {
          this.error = err.message || String(err);
          this.cdr.markForCheck();
          this.emitState({ error: this.error });
        });
      }
    });
  }

  private initPanZoom(svg: SVGSVGElement) {
    // Wrap in setTimeout to ensure DOM is ready and painted
    setTimeout(() => {
      if (!this.currentSvg) return; // Guard in case destroyed quickly

      this.panZoomInstance = this.panZoomLib(svg, {
        zoomEnabled: true,
        panEnabled: true,
        controlIconsEnabled: false,
        minZoom: 0.1,
        maxZoom: 20,
        fit: this.fitOnLoad,
        center: this.fitOnLoad,
        onZoom: (z: number) => this.zoomChange.emit(z),
      });
    }, 0);
  }

  private destroyPanZoom() {
    if (this.panZoomInstance) {
      try {
        this.panZoomInstance.destroy();
      } catch (e) {
        console.warn('Error destroying panzoom', e);
      }
      this.panZoomInstance = null;
    }
  }

  private clearHost() {
    const host = this.hostRef.nativeElement;
    while (host.firstChild) host.removeChild(host.firstChild);
    this.currentSvg = null;
  }

  private applyTheme() {
    if (!this.currentSvg) return;
    const bg = this.theme === 'dark' ? '#1e1e1e' : '#ffffff';
    const fg = this.theme === 'dark' ? '#e0e0e0' : '#1f1f1f';

    // Apply to host background
    this.hostRef.nativeElement.style.backgroundColor = bg;

    // Apply to SVG styles (basic override)
    // this.currentSvg.style.backgroundColor = bg;
    // this.currentSvg.style.color = fg;
    // this.currentSvg.style.fill = fg;
    // this.currentSvg.style.stroke = fg;
  }

  private emitState(state: DiagramViewerEvent) {
    this.loaded.emit(state);
    this.cdr.markForCheck();
  }

  // === Public API for Parent Component ===

  public fitToView() {
    if (this.panZoomInstance) {
      this.panZoomInstance.fit();
      this.panZoomInstance.center();
    }
  }

  public zoomIn() {
    this.panZoomInstance?.zoomIn();
  }

  public zoomOut() {
    this.panZoomInstance?.zoomOut();
  }

  public resetView() {
    this.panZoomInstance?.reset();
  }

  /**
   * Helper for export functionality in parent
   */
  public getSvgElement(): SVGSVGElement | null {
    return this.currentSvg || null;
  }
}
