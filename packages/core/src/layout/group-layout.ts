import { ASTGroup } from "../ast/ast-types";
import { GroupLayout, NodeLayout } from "../types/layout-types";

const PADDING = 40;

export function computeGroupLayout(
    groups: ASTGroup[],
    nodeLayouts: Record<string, NodeLayout>
): Record<string, GroupLayout> {

    const out: Record<string, GroupLayout> = {};

    for (const g of groups) {
        // naive auto-bounds: union of children
        const childBounds = g.children
            .filter(c => c.kind === "entity")
            .map(c => nodeLayouts[c.id]?.bounds)
            .filter(Boolean);

        const minX = Math.min(...childBounds.map(b => b.x)) - 32;
        const minY = Math.min(...childBounds.map(b => b.y)) - 32;
        const maxX = Math.max(...childBounds.map(b => b.x + b.width)) + 32;
        const maxY = Math.max(...childBounds.map(b => b.y + b.height)) + 32;

        out[g.name] = {
            name: g.name,
            ast: g,
            children: g.children
                .filter(c => c.kind === "entity")
                .map(c => (c as any).id),
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

