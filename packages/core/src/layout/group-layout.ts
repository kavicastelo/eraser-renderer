import {ASTGroup, ASTNode} from "../ast/ast-types";
import {GroupLayout, NodeLayout, Rect} from "../types/layout-types";

const PADDING = 40;

export function computeGroupLayout(
    groups: ASTGroup[],
    nodeLayouts: Record<string, NodeLayout>
): Record<string, GroupLayout> {

    const out: Record<string, GroupLayout> = {};

    for (const g of groups) {

        const entityChildren = g.children.filter(
            (c): c is ASTNode => c.kind === 'entity'
        );

        const childBounds = entityChildren
            .map(c => nodeLayouts[c.id]?.bounds)
            .filter((b): b is Rect => Boolean(b));

        if (childBounds.length === 0) {
            continue;
        }

        const minX = Math.min(...childBounds.map(b => b.x)) - 32;
        const minY = Math.min(...childBounds.map(b => b.y)) - 32;
        const maxX = Math.max(...childBounds.map(b => b.x + b.width)) + 32;
        const maxY = Math.max(...childBounds.map(b => b.y + b.height)) + 32;

        out[g.name] = {
            name: g.name,
            ast: g,
            children: entityChildren.map(c => c.id),
            padding: PADDING,
            bounds: {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
            }
        };
    }

    return out;
}
