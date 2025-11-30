# Eraser Renderer – Open Source Diagram Viewer & Editor  
**Beautiful architecture diagrams, flowcharts, and ER diagrams from simple text**

Live Demo: https://kavicastelo-eraser-renderer.vercel.app  
(Playground included – just type!)

```text
title System Architecture (simple)
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
```

→ Renders instantly with perfect layout, groups, icons, and smooth edges.

---

### Features

| Feature                        | Status       | Notes |
|-------------------------------|--------------|-------|
| Architecture / Flow diagrams  | Excellent    | Dagre-powered, looks like Eraser.io |
| ER diagrams (tables + fields) | Great        | Full PK/FK support |
| Groups / Clusters             | Perfect      | Nested, auto-sized |
| Zoom + Pan + Fit              | Built-in     | svg-pan-zoom |
| Dark / Light theme            | Built-in     | Toggle + event |
| Export PNG & SVG              | Built-in     | One-click |
| Live CodeMirror editor        | Built-in     | Real-time preview |
| Standalone Angular component  | Published-ready | Fully reusable |
| Pure TypeScript, no runtime deps on heavy frameworks | Yes | Only `dagre` + `svg-pan-zoom` |

---

### What Works Perfectly Today

- Flowcharts (`direction LR/TB`)
- System architecture diagrams
- Cloud & microservices diagrams
- Database schemas (ER-style)
- Simple sequence-like flows
- Nested groups with titles
- Icons (user, database, lock, etc.)
- Labels on edges
- Comma-expansion (`A, B --> C`)

### What Still Needs Love (Contributions Welcome!)

| Area                          | Status       | Help Wanted |
|-------------------------------|--------------|-------------|
| Sequence diagrams             | Not started  | Yes |
| BPMN / State charts           | Not started  | Yes |
| Advanced edge routing (curved, orthogonal with labels) | Basic | Yes |
| More built-in icons           | 12 icons     | PRs welcome |
| Click-to-edit nodes           | Not started  | Yes |
| Drag-to-create connections    | Not started  | Yes |
| More SVG themes (blueprint, hand-drawn, etc.) | One theme | Yes |

**Your contribution – no matter how small – will be warmly celebrated!**

---

### Quick Start

```bash
git clone https://github.com/kavicastelo/eraser-renderer.git
cd eraser-renderer

pnpm install
pnpm build      # build packages
pnpm dev        # starts packages in watch mode
pnpm test       # run tests
pnpm start      # launches the Angular playground at http://localhost:4200

# or

cd apps
ng build diagram-viewer   # build the angular library
ng serve playground       # launch the angular playground at http://localhost:4200
```

Open http://localhost:4200 → start typing!

---

### Use the Component in Your Project

```bash
npm install diagram-viewer
# or
pnpm add diagram-viewer
```

```ts
import { DiagramViewerComponent } from 'diagram-viewer';

@Component({
  standalone: true,
  imports: [DiagramViewerComponent],
  template: `<diagram-viewer [code]="myDiagram" theme="dark"></diagram-viewer>`
})
export class MyComponent {
  myDiagram = `title "My System"\nUser --> API --> Database`;
}
```

### Public API

```ts
@Input() code?: string;
@Input() ast?: DiagramAST;
@Input() theme: DiagramTheme = 'light';
@Input() showToolbar = true;
@Input() fitOnLoad = true;
@Input() diagramType?: string;

@Output() loaded = new EventEmitter<DiagramViewerEvent>();
@Output() zoomChange = new EventEmitter<number>();

fitToView();
zoomIn(); zoomOut(); resetView();
toggleTheme(); setTheme('dark');
```

---

### Project Structure

```
packages/
├── core/          ← Parser, lexer, AST, Dagre layout
└── viewer/        ← Pure-TS SVG renderer (renderNode, renderGroup, renderEdge)
apps/
└── playground/    ← Full-featured editor with CodeMirror + export
apps/projects/diagram-viewer/ ← Reusable Angular component
```

---

### Contributing

We **love** contributions of any kind!

- Fix a bug
- Add a new icon
- Improve edge routing
- Implement sequence diagrams
- Add tests
- Improve documentation
- Share your diagram on Twitter/X and tag us!

**How to contribute**

```bash
git checkout -b feat/curved-edges
# make your changes
pnpm test        # (add tests if possible)
pnpm build
git commit -m "feat: curved edges with labels"
git push origin feat/curved-edges
```

Open a PR → we’ll review fast and merge with hugs.

**Code owners & maintainers**

- Kavicastelo – original author & benevolent dictator for life (but very friendly)

---

### License

MIT © 2025 Kavicastelo and contributors

You can use this in commercial products, personal projects, or even sell it. Just keep the license and give us a star!

---

### Thank You!

This project exists because people like **you** care about beautiful, open-source tools.

Every star, issue, and PR makes this better for everyone.

Let’s build the best open-source diagram tool together.

— Kavicastelo & the Eraser Renderer community

Made with love and a lot of coffee.
