import { ASTNode } from "../ast/ast-types";
import { NodeLayout } from "../types/layout-types";

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const NODE_SPACING_X = 200; // 50
const NODE_SPACING_Y = 120; // 50

export function computeNodeLayout(nodes: ASTNode[]): Record<string, NodeLayout> {
    const out: Record<string, NodeLayout> = {};

    let x = NODE_SPACING_X, y = NODE_SPACING_Y;

    for (const n of nodes) {
        out[n.id] = {
            id: n.id,
            ast: n,
            label: n.id,
            bounds: { x, y, width: NODE_WIDTH, height: NODE_HEIGHT },
            ports: []
        };

        y += 120;
    }

    return out;
}
