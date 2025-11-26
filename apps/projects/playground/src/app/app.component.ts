import {Component, ViewChild, ElementRef, AfterViewInit, OnDestroy, inject} from '@angular/core';
import { DiagramViewerComponent } from 'diagram-viewer';
import { basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { NgIf } from '@angular/common';
import { saveAs } from 'file-saver';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

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

  codeText = `title Role–Permission Matrix

direction right
colorMode pastel
styleMode shadow
typeface clean

// Roles
Roles {
    super_admin[icon: shield, color: blue, label: "Super Admin"]
    enterprise_admin[icon: building, color: blue, label: "Enterprise Admin"]
    coach_user[icon: user, color: blue, label: "Coach / User"]
}

// Modules
Modules {
    org_mgmt[icon: settings, color: green, label: "Organization Management"]
    user_mgmt[icon: users, color: green, label: "User & Coach Mgmt"]
    billing[icon: creditcard, color: green, label: "Billing & Invoicing"]
    reports[icon: chart, color: green, label: "Reports & Analytics"]
}

// Role → Permission mappings
super_admin>org_mgmt: Full Access
super_admin>user_mgmt: Full Access
super_admin>billing: Full Access
super_admin>reports: Full Access

enterprise_admin>org_mgmt: Manage Org
enterprise_admin>user_mgmt: Manage Users
enterprise_admin>billing: View Billing
enterprise_admin>reports: View Reports

coach_user>user_mgmt: Request Verification
coach_user>reports: Limited Insights
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

    this.editor = new EditorView({
      state: EditorState.create({
        doc: this.codeText,
        extensions: [
          basicSetup,
          javascript(),
          this.isDark ? oneDark : [],
          updateListener,
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
          '&': { height: '100%' },
          '.cm-scroller': { fontFamily: 'Fira Code, monospace' },
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
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
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
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      // Handle High DPI
      canvas.width = (this.diagramViewer.hostRef.nativeElement.clientWidth || 800) * 2;
      canvas.height = (this.diagramViewer.hostRef.nativeElement.clientHeight || 600) * 2;
      ctx.fillStyle = this.isDark ? '#1e1e1e' : '#ffffff';
      ctx.fillRect(0,0, canvas.width, canvas.height);
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
