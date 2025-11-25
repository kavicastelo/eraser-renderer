import { DiagramAST } from "../ast/ast-types";
import { computeNodeLayout } from "./node-layout";
import { computeGroupLayout } from "./group-layout";
import { computeEdgeRouting } from "./edge-routing";
import { DiagramLayout, Rect } from "../types/layout-types";

export function computeDiagramLayout(ast: DiagramAST): DiagramLayout {
    // 1. Compute node layout (raw entities only)
    const entities = ast.rootBlocks.filter(b => b.kind === "entity") as any[];
    const nodeLayouts = computeNodeLayout(entities);

    // 2. Compute group layout (if any)
    const groups = ast.rootBlocks.filter(b => b.kind === "group") as any[];
    const groupLayouts = computeGroupLayout(groups, nodeLayouts);

    // 3. Compute edges
    const routedEdges = computeEdgeRouting(ast.edges, groupLayouts, nodeLayouts);

    // 4. Compute global diagram bounds
    const bounds = computeDiagramBounds(nodeLayouts, groupLayouts);

    return {
        nodes: nodeLayouts,
        groups: groupLayouts,
        edges: routedEdges,
        bounds
    };
}


/* ============================================
 * Utility: compute full diagram bounding box
 * ============================================ */

function computeDiagramBounds(
    nodes: Record<string, { bounds: Rect }>,
    groups: Record<string, { bounds: Rect }>
): Rect {
    const allRects: Rect[] = [];

    for (const n of Object.values(nodes)) allRects.push(n.bounds);
    for (const g of Object.values(groups)) allRects.push(g.bounds);

    if (allRects.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }

    const minX = Math.min(...allRects.map(r => r.x));
    const minY = Math.min(...allRects.map(r => r.y));
    const maxX = Math.max(...allRects.map(r => r.x + r.width));
    const maxY = Math.max(...allRects.map(r => r.y + r.height));

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}
