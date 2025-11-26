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
    LayoutResult
} from '@eraser/core';

/**
 * High-quality layout using Dagre (same as Mermaid)
 */
export function computeDiagramLayout(ast: DiagramAST): LayoutResult {
    const g = new dagre.graphlib.Graph({ compound: true });

    // Dagre config
    g.setGraph({
        rankdir: getRankDirection(ast),
        nodesep: 80,
        edgesep: 40,
        ranksep: 100,
        marginx: 40,
        marginy: 40,
    });

    g.setDefaultEdgeLabel(() => ({ labelpos: 'c' }));

    // === 1. Add Nodes ===
    const nodeMap = new Map<string, ASTNode>();
    const allNodes = collectAllNodes(ast);

    allNodes.forEach((node) => {
        nodeMap.set(node.id, node);

        const width = estimateNodeWidth(node);
        const height = estimateNodeHeight(node);

        g.setNode(node.id, {
            width,
            height,
            ast: node,
        });
    });

    // === 2. Add Groups (as compound nodes) ===
    const groupMap = new Map<string, ASTGroup>();
    collectAllGroups(ast).forEach((group) => {
        groupMap.set(group.name, group);

        // Use a reasonable default size; Dagre will expand it automatically
        g.setNode(group.name, {
            width: 300,
            height: 200,
            cluster: true,
            ast: group,
        } as any);

        // Add children to parent group
        collectAllNodesInGroup(group).forEach((childNode) => {
            g.setParent(childNode.id, group.name);
        });
    });

    // === 3. Add Edges ===
    ast.edges.forEach((edge, i) => {
        const from = edge.from;
        const to = edge.to;

        // Ensure nodes exist (parser sometimes references missing nodes)
        if (!g.hasNode(from)) {
            g.setNode(from, { width: 140, height: 60, ast: { kind: 'entity', id: from, attrs: {} } } as any);
        }
        if (!g.hasNode(to)) {
            g.setNode(to, { width: 140, height: 60, ast: { kind: 'entity', id: to, attrs: {} } } as any);
        }

        g.setEdge(from, to, {
            id: `edge_${i}`,
            ast: edge,
            label: edge.label,
            kind: edge.kind,
        });
    });

    // === 4. Run Layout ===
    dagre.layout(g);

    // === 5. Extract Results ===
    const nodes: Record<string, NodeLayout> = {};
    const groups: Record<string, GroupLayout> = {};
    const edges: RoutedEdge[] = [];

    // Nodes
    g.nodes().forEach((id) => {
        const n: any = g.node(id);
        if (!n || n.cluster) return; // skip groups

        const label = n.ast.attrs?.label || n.ast.id || id;

        nodes[id] = {
            id,
            ast: n.ast,
            label,
            bounds: {
                x: n.x - n.width / 2,
                y: n.y - n.height / 2,
                width: n.width,
                height: n.height,
            },
            ports: [],
        };
    });

    // Groups
    g.nodes().forEach((id) => {
        const n: any = g.node(id);
        if (!n?.cluster) return;

        const groupAst = n.ast as ASTGroup;
        const childIds: any = g.children(id) || [];

        groups[groupAst.name] = {
            name: groupAst.name,
            ast: groupAst,
            children: childIds,
            padding: 40,
            bounds: {
                x: n.x - n.width / 2,
                y: n.y - n.height / 2,
                width: n.width,
                height: n.height,
            },
        };
    });

    // Edges with real bend points
    g.edges().forEach((e) => {
        const edge = g.edge(e);
        const astEdge = edge.ast as ASTEdge;

        const points = edge.points.map((p: any) => ({ x: p.x, y: p.y }));

        edges.push({
            id: edge.id || `${e.v}-${e.w}`,
            from: e.v,
            to: e.w,
            kind: astEdge.kind,
            label: astEdge.label,
            points,
            ast: astEdge,
        });
    });

    // === 6. Compute overall bounds ===
    const allBounds = computeDiagramBounds(
        Object.values(nodes).map((n) => n.bounds),
        Object.values(groups).map((g) => g.bounds)
    );

    return { nodes, groups, edges, width: allBounds.width, height: allBounds.height };
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
