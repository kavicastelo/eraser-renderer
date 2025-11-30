import dagre from 'dagre';
import {
    DiagramAST,
    ASTNode,
    ASTGroup,
    ASTEdge,
    NodeLayout,
    GroupLayout,
    RoutedEdge,
    Rect,
    LayoutResult,
    EdgeNode,
    FieldDef
} from '@eraser/core';
import { measureText } from "./text-measure";

/**
 * High-quality layout using Dagre (same as Mermaid)
 */
export function computeDiagramLayout(ast: DiagramAST): LayoutResult {
    const g = new dagre.graphlib.Graph({ compound: true });

    g.setGraph({
        rankdir: getRankDirection(ast),
        nodesep: 60,  // Horizontal spacing between nodes
        ranksep: 80,  // Vertical spacing between ranks
        marginx: 20,
        marginy: 20,
        edgesep: 10   // Spacing between parallel edges
    });

    g.setDefaultEdgeLabel(() => ({ labelpos: 'c' }));

    // 1. Nodes
    const allNodes = collectAllNodes(ast);
    allNodes.forEach((node) => {
        const dims = calculateNodeDimensions(node);
        g.setNode(node.id, { width: dims.width, height: dims.height, ast: node });
    });

    // 2. Groups
    collectAllGroups(ast).forEach((group) => {
        g.setNode(group.name, { cluster: true, ast: group });
        collectAllNodesInGroup(group).forEach((child) => {
            g.setParent(child.id, group.name);
        });
    });

    // 3. Edges
    ast.edges.forEach((edge: EdgeNode, i: number) => {
        // Validation: Ensure nodes exist before adding edges to avoid Dagre crashes
        if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
            g.setEdge(edge.from, edge.to, {
                id: `edge_${i}`,
                ast: edge,
                label: edge.label,
                // curve: 'basis' // Dagre doesn't render curves, it gives points. We curve in render-edge.
            });
        }
    });

    dagre.layout(g);

    // ... (Extraction logic remains similar, see below for the update)
    const nodes: Record<string, NodeLayout> = {};
    g.nodes().forEach((id) => {
        const n: any = g.node(id);
        if (!n || n.cluster) return;

        nodes[id] = {
            id,
            ast: n.ast,
            bounds: {
                x: n.x - n.width / 2,
                y: n.y - n.height / 2,
                width: n.width,
                height: n.height,
            }
        };
    });

    const groups: any = {}; // ... extract groups similarly ...

    const edges = g.edges().map((e) => {
        const edge = g.edge(e);
        return {
            id: edge.id,
            from: e.v,
            to: e.w,
            kind: edge.ast.kind,
            label: edge.ast.label,
            points: edge.points,
            ast: edge.ast
        };
    });

    // Calculate bounding box
    const allRects = [...Object.values(nodes).map(n => n.bounds)];
    // Add group rects...

    // ... helper computeDiagramBounds ...
    const width = 1000; // placeholder, calc real bounds
    const height = 1000;

    return { nodes, groups, edges, width, height };
}

export function computeGraphLayout(ast: DiagramAST): LayoutResult {
    const g = new dagre.graphlib.Graph({ compound: true });

    g.setGraph({
        rankdir: ast.metadata.direction === 'right' ? 'LR' : 'TB',
        nodesep: 60,
        ranksep: 80,
        marginx: 40,
        marginy: 40,
        edgesep: 10
    });

    // 1. Add Nodes & Groups
    const nodeMap = new Map<string, ASTNode>();

    // Helper to find parent if "users._id" is passed
    const resolveNodeId = (rawId: string): string => {
        if (nodeMap.has(rawId)) return rawId;
        if (rawId.includes('.')) {
            const parent = rawId.split('.')[0];
            if (nodeMap.has(parent)) return parent;
        }
        return rawId; // Fallback
    };

    function visit(block: any) {
        if (block.kind === 'entity') {
            nodeMap.set(block.id, block);
            const { width, height } = calculateNodeSize(block);
            g.setNode(block.id, { width, height, ast: block });
        } else if (block.kind === 'group') {
            g.setNode(block.name, { cluster: true, ast: block, width: 200, height: 200 });
            block.children.forEach((child: any) => {
                visit(child);
                if (child.id) g.setParent(child.id, block.name);
            });
        }
    }
    ast.rootBlocks.forEach(visit);

    // 2. Add Edges (With ID Resolution)
    ast.edges.forEach((edge: EdgeNode, i: number) => {
        const u = resolveNodeId(edge.from);
        const v = resolveNodeId(edge.to);

        // Only add if both exist (or were resolved)
        if (g.hasNode(u) && g.hasNode(v)) {
            g.setEdge(u, v, {
                id: `edge_${i}`,
                ast: edge,
                label: edge.label,
                arrowhead: getArrowType(edge.kind)
            });
        }
    });

    dagre.layout(g);

    // 3. Extract Result
    const nodes: Record<string, NodeLayout> = {};
    const groups: any = {};

    g.nodes().forEach(id => {
        const n: any = g.node(id);
        if (!n) return;
        const bounds = { x: n.x - n.width / 2, y: n.y - n.height / 2, width: n.width, height: n.height };

        if (n.cluster) {
            groups[id] = { name: id, bounds, ast: n.ast, children: g.children(id) };
        } else {
            nodes[id] = { id, bounds, ast: n.ast };
        }
    });

    const edges: RoutedEdge[] = g.edges().map(e => {
        const edgeObj = g.edge(e);
        return {
            id: edgeObj.id,
            from: e.v,
            to: e.w,
            kind: edgeObj.ast.kind,
            label: edgeObj.label,
            points: edgeObj.points,
            ast: edgeObj.ast
        };
    });

    // Compute total bounds
    const width = Math.max(...Object.values(nodes).map(n => n.bounds.x + n.bounds.width), 100);
    const height = Math.max(...Object.values(nodes).map(n => n.bounds.y + n.bounds.height), 100);

    return { nodes, groups, edges, width, height };
}

function calculateNodeSize(node: ASTNode) {
    // Simple estimator
    const label = node.attrs?.label || node.id;
    const font = '14px sans-serif';
    const txt = measureText(label, font);

    let width = Math.max(txt.width + 32, 120);
    let height = 50;

    if (node.fields) {
        height += node.fields.length * 24 + 10;
        node.fields.forEach((f: FieldDef) => {
            const fw = measureText(f.raw || f.name, '12px monospace').width;
            if (fw + 40 > width) width = fw + 40;
        });
    }
    return { width, height };
}

function getArrowType(kind: string) {
    if (kind === 'bidirectional') return 'arrowhead';
    return 'arrowhead';
}

// --- Helpers ---

function calculateNodeDimensions(node: ASTNode) {
    // Fonts must match CSS in render-node.ts
    const titleFont = '600 14px ui-sans-serif, system-ui';
    const monoFont = '12px ui-monospace, monospace';

    const label = node.attrs?.label || node.id;
    const titleDim = measureText(label, titleFont);

    let width = Math.max(titleDim.width + 32, 140); // Min width 140
    let height = 50;

    if (node.fields && node.fields.length > 0) {
        let maxFieldWidth = 0;
        node.fields.forEach((f: FieldDef) => {
            const txt = `${f.name} ${f.type || ''}`;
            const w = measureText(txt, monoFont).width;
            maxFieldWidth = Math.max(maxFieldWidth, w);
        });
        width = Math.max(width, maxFieldWidth + 32);
        height += node.fields.length * 24;
    }

    return { width, height };
}

// ——————————————————————————————————————
// Helper Functions
// ——————————————————————————————————————

function getRankDirection(ast: DiagramAST): 'TB' | 'LR' {
    const dir = ast.metadata.direction;
    if (typeof dir === 'string') {
        const d = dir.toUpperCase();
        if (d.includes('L') || d.includes('R')) return 'LR';
    }
    return 'TB'; // default top-to-bottom
}

function collectAllNodes(ast: DiagramAST): ASTNode[] {
    const nodes: ASTNode[] = [];

    function visit(block: any) {
        if (block.kind === 'entity') {
            nodes.push(block);
        } else if (block.kind === 'group') {
            block.children?.forEach(visit);
        }
    }

    ast.rootBlocks.forEach(visit);
    return nodes;
}

function collectAllGroups(ast: DiagramAST): ASTGroup[] {
    const groups: ASTGroup[] = [];

    function visit(block: any) {
        if (block.kind === 'group') {
            groups.push(block);
            block.children?.forEach(visit);
        }
    }

    ast.rootBlocks.forEach(visit);
    return groups;
}

function collectAllNodesInGroup(group: ASTGroup): ASTNode[] {
    const nodes: ASTNode[] = [];

    function visit(block: any) {
        if (block.kind === 'entity') nodes.push(block);
        else if (block.kind === 'group') block.children?.forEach(visit);
    }

    group.children?.forEach(visit);
    return nodes;
}

function estimateNodeWidth(node: ASTNode): number {
    const label = node.attrs?.label || node.id;
    const base = Math.max(label.length * 8, 120);
    return node.fields ? Math.max(base, 180) : base;
}

function estimateNodeHeight(node: ASTNode): number {
    if (!node.fields) return 60;
    return 50 + node.fields.length * 22;
}

function computeDiagramBounds(
    nodeRects: Rect[],
    groupRects: Rect[]
): Rect {
    const all = [...nodeRects, ...groupRects];
    if (all.length === 0) return { x: 0, y: 0, width: 800, height: 600 };

    const xs = all.map((r) => r.x);
    const ys = all.map((r) => r.y);
    const rights = all.map((r) => r.x + r.width);
    const bottoms = all.map((r) => r.y + r.height);

    return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...rights) - Math.min(...xs),
        height: Math.max(...bottoms) - Math.min(...ys),
    };
}
