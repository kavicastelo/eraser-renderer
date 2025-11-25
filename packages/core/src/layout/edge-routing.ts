import { ASTEdge, ASTGroup } from "@eraser/core";
import { RoutedEdge, NodeLayout, GroupLayout } from "@eraser/core";


export function computeEdgeRouting(
    edges: ASTEdge[],
    groups: Record<string, GroupLayout>,
    nodes: Record<string, NodeLayout>
): RoutedEdge[] {

    return edges.map((e, i) => {
        const from = nodes[e.from];
        const to = nodes[e.to];

        return {
            id: `edge_${i}`,
            ast: e,
            from: e.from,
            to: e.to,
            kind: e.kind,
            label: e.label,
            points: [
                {
                    x: from.bounds.x + from.bounds.width,
                    y: from.bounds.y + from.bounds.height / 2
                },
                {
                    x: to.bounds.x,
                    y: to.bounds.y + to.bounds.height / 2
                }
            ]
        };
    });
}
