import {
    DiagramAST,
    ASTNode,
    ASTGroup,
    ASTEdge,
    NodeLayout,
    GroupLayout,
    RoutedEdge,
    BlockNode,
    computeNodeLayout,
    computeGroupLayout,
    computeEdgeRouting
} from '@eraser/core';

export interface LayoutResult {
    nodes: Record<string, NodeLayout>;
    groups: Record<string, GroupLayout>;
    edges: RoutedEdge[];
    width: number;
    height: number;
}

export function computeLayout(ast: DiagramAST): LayoutResult {
    const astNodes = ast.rootBlocks.filter((b: BlockNode) => b.kind === 'entity') as ASTNode[];
    const astGroups = ast.rootBlocks.filter((b: BlockNode) => b.kind === 'group') as ASTGroup[];
    const astEdges = ast.edges as ASTEdge[];

    const nodes = computeNodeLayout(astNodes);
    const groups = computeGroupLayout(astGroups, nodes);
    const edges = computeEdgeRouting(astEdges, groups, nodes);

    const allBounds = Object.values(nodes).map((n: NodeLayout) => n.bounds);

    const width = Math.max(...allBounds.map(b => b.x + b.width), 1000);
    const height = Math.max(...allBounds.map(b => b.y + b.height), 600);

    return { nodes, groups, edges, width, height };
}
