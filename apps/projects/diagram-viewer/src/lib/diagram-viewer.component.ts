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
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';

import {parseEraserDSL, DiagramAST} from '@eraser/core';
import {computeDiagramLayout, renderToSVGElement} from '@eraser/viewer';
import {NgIf} from '@angular/common';

/**
 * Angular wrapper component that:
 *  - accepts `code` (string) or `ast` (DiagramAST)
 *  - builds layout via core
 *  - renders SVG via the pure TS viewer renderer
 *
 * Usage:
 * <diagram-viewer [code]="codeText"></diagram-viewer>
 * OR
 * <diagram-viewer [ast]="astObj"></diagram-viewer>
 */
@Component({
  selector: 'diagram-viewer',
  template: `
    <div class="diagram-viewer-root">
      <div class="toolbar">
        <button (click)="fitToView()">Fit</button>
        <button (click)="resetView()">Reset</button>
      </div>

      <div #host class="svg-host" aria-live="polite"></div>

      <div *ngIf="error" class="error">
        <strong>Render error:</strong>
        <pre>{{ error }}</pre>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }

    .svg-host {
      width: 100%;
      height: 100%;
      min-height: calc(100vh - 32px);
      overflow: auto;
      background: var(--viewer-bg, #fff);
    }

    .toolbar {
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 20;
      display: flex;
      gap: 8px;
    }

    .error {
      position: absolute;
      left: 8px;
      bottom: 8px;
      right: 8px;
      background: rgba(255, 240, 240, 0.95);
      padding: 8px;
      border-radius: 6px;
      color: #900;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgIf
  ],
  standalone: true
})
export class DiagramViewerComponent implements OnChanges, AfterViewInit {
  /** Either provide raw Eraser DSL code or a DiagramAST. AST takes precedence. */
  @Input() code?: string;
  @Input() ast?: DiagramAST;

  /** Emits when an AST/layout/svg becomes available or on error */
  @Output() loaded = new EventEmitter<{ ast?: DiagramAST; svg?: SVGSVGElement; error?: string }>();

  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  error?: string;
  private currentSvg?: SVGSVGElement | null;

  // viewbox management for fit/reset (keeps a copy of last bounds)
  private lastBounds: { width: number; height: number } | null = null;

  constructor(private cd: ChangeDetectorRef, private zone: NgZone) {}

  ngAfterViewInit(): void {
    // initial render if inputs are already set
    this.rebuild();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // rebuild on input changes
    if (changes['code'] || changes['ast']) {
      this.rebuild();
    }
  }

  private rebuild() {
    // run reconstruction outside Angular to avoid heavy sync work causing change detection churn
    this.zone.runOutsideAngular(() => {
      try {
        this.error = undefined;
        // 1) get AST
        const ast = this.ast ?? (this.code ? parseEraserDSL(this.code, 'unknown') : undefined);

        if (!ast) {
          this.clearHost();
          this.emitLoaded(undefined, undefined, 'No code or AST provided');
          return;
        }

        // 2) compute layout
        const layout = computeDiagramLayout(ast);

        // store bounds for fitToView
        if (!layout?.width || !layout?.height) {
          throw new Error("Layout has no bounds — AST incomplete or invalid.");
        }

        this.lastBounds = {
          width: layout.width,
          height: layout.height
        };

        // 3) render to an SVG element (pure TS viewer)
        const svg = renderToSVGElement(ast);

        // ensure the returned element is an <svg>
        if (!svg || !(svg.svg instanceof SVGSVGElement)) {
          throw new Error('Renderer did not return an SVG element.');
        }

        // 4) insert into DOM (back in Angular zone)
        this.zone.run(() => {
          this.clearHost();
          // style wrapper to make svg responsive
          svg.svg.setAttribute('width', '100%');
          svg.svg.setAttribute('height', '100%');
          svg.svg.style.display = 'block';
          this.hostRef.nativeElement.appendChild(svg.svg);
          this.currentSvg = svg.svg;
          this.cd.markForCheck();
          this.emitLoaded(ast, svg.svg, undefined);
        });

      } catch (err: any) {
        const msg = (err && err.message) ? err.message : String(err);
        this.zone.run(() => {
          this.clearHost();
          this.error = msg;
          this.cd.markForCheck();
          this.emitLoaded(undefined, undefined, msg);
        });
      }
    });
  }

  private clearHost() {
    const host = this.hostRef?.nativeElement;
    if (!host) return;
    // remove all children
    while (host.firstChild) host.removeChild(host.firstChild);
    this.currentSvg = null;
  }

  private emitLoaded(ast?: DiagramAST, svg?: SVGSVGElement, error?: string) {
    this.loaded.emit({ ast, svg, error });
  }

  // Public API: fit to view and reset view
  fitToView(padding = 24) {
    if (!this.currentSvg || !this.lastBounds) return;
    // center / fit by setting viewBox
    const w = Math.max(100, this.lastBounds.width + padding * 2);
    const h = Math.max(100, this.lastBounds.height + padding * 2);
    this.currentSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  resetView() {
    if (!this.currentSvg) return;
    // clear viewBox so default SVG scaling applies
    this.currentSvg.removeAttribute('viewBox');
  }
}
