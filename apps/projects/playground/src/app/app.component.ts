import {Component, ViewChild, ElementRef, AfterViewInit, OnDestroy, inject} from '@angular/core';
import {DiagramViewerComponent} from 'diagram-viewer';
import {basicSetup} from 'codemirror';
import {javascript} from '@codemirror/lang-javascript';
import {oneDark} from '@codemirror/theme-one-dark';
import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {NgIf} from '@angular/common';
import {saveAs} from 'file-saver';
import {isPlatformBrowser} from '@angular/common';
import {PLATFORM_ID} from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DiagramViewerComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit {
  @ViewChild('viewer') diagramViewer!: DiagramViewerComponent;
  @ViewChild('editor') editorRef!: ElementRef;

  private readonly platformId = inject(PLATFORM_ID);

  codeText = `title System Architecture (simple)
direction right
colorMode pastel
styleMode shadow

// -----------------------
// FRONTEND
// -----------------------
group frontend {
    spa[icon: web, label: "Angular SPA", color: red]
    pwa[icon: web, label: "PWA (optional)", color: yellow]
}

// -----------------------
// API GATEWAY
// -----------------------
gateway[icon: cloud, label: "API Gateway", color: orange]


// -----------------------
// MICROSERVICES
// -----------------------
group services {
    auth[icon: server, label: "Auth Service", color: blue]
    user[icon: server, label: "User Service", color: purple]
    coach[icon: server, label: "Coach Service", color: neutral]
    booking[icon: server, label: "Booking Service", color: neutral]
    ai[icon: server, label: "AI Service", color: "#000"]
    payment[icon: server, label: "Payment Service", color: purple]
    notif[icon: server, label: "Notification Service", color: gray]
    analytics[icon: server, label: "Analytics Service", color: purple]
}

// -----------------------
// DATA / STORAGE / EXTERNALS
// -----------------------
group storage {
    mongo[icon: mongodb, label: "MongoDB Cluster", color: green]
    redis[icon: cache, label: "Redis Cache", color: "#000"]
    kafka[icon: kafka, label: "Kafka Event Bus", color: blue]
    elastic[icon: search, label: "ElasticSearch", color: orange]
    s3[icon: storage, label: "Object Storage (S3)", color: green]
    openai[icon: ai, label: "OpenAI API", color: "#000"]
    zoom[icon: video, label: "Zoom/WebRTC", color: blue]
}


// -----------------------
// CONNECTIONS
// -----------------------

// Frontend → Gateway
spa>gateway
pwa>gateway

// Gateway → Microservices
gateway>auth
gateway>user
gateway>coach
gateway>booking
gateway>ai
gateway>payment
gateway>notif
gateway>analytics

// Microservices → Datastores
user>mongo
coach>mongo
booking>mongo
payment>mongo
analytics>mongo

// Event-driven connections
booking>kafka
payment>kafka
notif>kafka

// Specialized integrations
coach>elastic
ai>openai
payment>s3
booking>zoom
`;

  isDark = false;
  error = '';
  private editor!: EditorView;

  get isBrowser() {
    return isPlatformBrowser(this.platformId);
  }

  async ngAfterViewInit() {
    if (!this.isBrowser) return;
    this.initCodeMirror();
    this.onCodeChange(); // initial render
  }

  private initCodeMirror() {
    if (!this.isBrowser) return;
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        this.codeText = update.state.doc.toString();
        this.onCodeChange();
      }
    });
    const theme = EditorView.theme({
      '&': {height: '100%'},
      '.cm-scroller': {fontFamily: 'Fira Code, monospace'},
    });

    this.editor = new EditorView({
      state: EditorState.create({
        doc: this.codeText,
        extensions: [
          basicSetup,
          javascript(),
          this.isDark ? oneDark : [],
          updateListener,
          theme
        ],
      }),
      parent: this.editorRef.nativeElement,
    });
  }

  onLoaded(event: any) {
    if (!this.isBrowser) return;
    if (event.error) {
      this.error = event.error;
    } else {
      this.error = '';
    }
  }

  fitToView() {
    if (!this.isBrowser) return;
    this.diagramViewer?.fitToView();
  }

  resetZoom() {
    if (!this.isBrowser) return;
    this.diagramViewer?.resetView();
  }

  toggleTheme() {
    if (!this.isBrowser) return;
    this.isDark = !this.isDark;
    document.body.classList.toggle('dark', this.isDark);

    // Create a new EditorState with the updated theme
    const newState = EditorState.create({
      doc: this.codeText,
      extensions: [
        basicSetup,
        javascript(),
        this.isDark ? oneDark : [],
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            this.codeText = update.state.doc.toString();
            this.onCodeChange();
          }
        }),
        EditorView.theme({
          '&': {height: '100%'},
          '.cm-scroller': {fontFamily: 'Fira Code, monospace'},
        }),
      ],
    });

    // Update the editor state by dispatching the change
    this.editor.setState(newState);

    // Re-render diagram with new background
    this.onCodeChange();
  }

  // === Export Logic ===

  exportSVG() {
    if (!this.isBrowser) return;

    // Ask the library for the current SVG element safely
    const svg = this.diagramViewer?.hostRef.nativeElement.querySelector('svg');

    if (!svg) return;
    const blob = new Blob([svg.outerHTML], {type: 'image/svg+xml'});
    saveAs(blob, 'diagram.svg');
  }

  async exportPNG() {
    const svg = this.diagramViewer?.hostRef.nativeElement.querySelector('svg');
    if (!svg) return;

    // Standard canvas drawing logic...
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      // Handle High DPI
      canvas.width = (this.diagramViewer.hostRef.nativeElement.clientWidth || 800) * 2;
      canvas.height = (this.diagramViewer.hostRef.nativeElement.clientHeight || 600) * 2;
      ctx.fillStyle = this.isDark ? '#1e1e1e' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((b) => {
        saveAs(b!, 'diagram.png');
        URL.revokeObjectURL(url);
      });
    };
    img.src = url;
  }

  private onCodeChange() {
    if (!this.isBrowser) return;
    // Trigger re-render
    this.codeText = this.codeText;
  }

  onZoom($event: number) {

  }
}
