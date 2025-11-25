import {
    DiagramAST,
    ASTNode,
    ASTGroup,
    ASTEdge,
    NodeLayout,
    GroupLayout,
    RoutedEdge,
} from '@eraser-renderer/core';

import { computeNodeLayout } from '@eraser-renderer/core/dist/layout/node-layout';
import { computeGroupLayout } from '@eraser-renderer/core/dist/layout/group-layout';
import { computeEdgeRouting } from '@eraser-renderer/core/dist/layout/edge-routing';

export interface LayoutResult {
    nodes: Record<string, NodeLayout>;
    groups: Record<string, GroupLayout>;
    edges: RoutedEdge[];
    width: number;
    height: number;
}

export function computeLayout(ast: DiagramAST): LayoutResult {
    const astNodes = ast.rootBlocks.filter(b => b.kind === 'entity') as ASTNode[];
    const astGroups = ast.rootBlocks.filter(b => b.kind === 'group') as ASTGroup[];
    const astEdges = ast.edges as ASTEdge[];

    const nodes = computeNodeLayout(astNodes);
    const groups = computeGroupLayout(astGroups, nodes);
    const edges = computeEdgeRouting(astEdges, groups, nodes);

    const allBounds = Object.values(nodes).map(n => n.bounds);

    const width = Math.max(...allBounds.map(b => b.x + b.width), 1000);
    const height = Math.max(...allBounds.map(b => b.y + b.height), 600);

    return { nodes, groups, edges, width, height };
}
