import { DiagramAST, LayoutResult, NodeLayout, RoutedEdge } from '@eraser/core';

export function computeSequenceLayout(ast: DiagramAST): LayoutResult {
    const nodes: Record<string, NodeLayout> = {};
    const edges: RoutedEdge[] = [];

    const PARTICIPANT_MARGIN = 150; // Horizontal space
    const MESSAGE_HEIGHT = 60;      // Vertical space per message
    const HEADER_HEIGHT = 60;
    const START_Y = 20;

    // 1. Identify Participants (Order matters!)
    const participants: string[] = [];

    // Use 'order' metadata if available, otherwise collection order
    // (You'd parse "order user, gateway" from metadata in parser, assuming simple string for now)

    const collect = (blocks: any[]) => {
        blocks.forEach(b => {
            if (b.kind === 'entity') participants.push(b.id);
            if (b.kind === 'group') collect(b.children);
        });
    }
    collect(ast.rootBlocks);

    // Dedupe
    const uniqueParticipants = Array.from(new Set(participants));

    // 2. Position Participants (The Columns)
    let currentX = 40;
    uniqueParticipants.forEach(id => {
        // Find AST node
        const findNode = (blocks: any[]): any => {
            for(const b of blocks) {
                if(b.kind === 'entity' && b.id === id) return b;
                if(b.kind === 'group') {
                    const found = findNode(b.children);
                    if(found) return found;
                }
            }
        };
        const astNode = findNode(ast.rootBlocks) || { kind: 'entity', id, attrs: {} };

        nodes[id] = {
            id,
            ast: astNode,
            bounds: { x: currentX, y: START_Y, width: 120, height: 40 },
            // In sequence, height is just the header box.
            // The lifeline is drawn separately in renderer or implied.
        };
        currentX += PARTICIPANT_MARGIN;
    });

    // 3. Position Edges (The Rows)
    let currentY = START_Y + HEADER_HEIGHT + 40;

    ast.edges.forEach((edge, i) => {
        const sourceNode = nodes[edge.from];
        const targetNode = nodes[edge.to];

        if (!sourceNode || !targetNode) return;

        // Sequence edges are horizontal lines
        const x1 = sourceNode.bounds.x + (sourceNode.bounds.width / 2);
        const x2 = targetNode.bounds.x + (targetNode.bounds.width / 2);

        // Self message? (Loop back)
        if (edge.from === edge.to) {
            edges.push({
                id: `seq_${i}`,
                from: edge.from,
                to: edge.to,
                kind: edge.kind,
                label: edge.label,
                points: [
                    { x: x1, y: currentY },
                    { x: x1 + 40, y: currentY },
                    { x: x1 + 40, y: currentY + 20 },
                    { x: x1, y: currentY + 20 }
                ],
                ast: edge
            });
            currentY += 30; // Extra space
        } else {
            edges.push({
                id: `seq_${i}`,
                from: edge.from,
                to: edge.to,
                kind: edge.kind,
                label: edge.label,
                points: [
                    { x: x1, y: currentY },
                    { x: x2, y: currentY }
                ],
                ast: edge
            });
        }

        currentY += MESSAGE_HEIGHT;
    });

    // Lifeline Extension:
    // We can cheat and make the node height huge so the border draws a box?
    // No, standard sequence diagrams have a dashed line.
    // We will handle the dashed line in the RENDERER, based on the total height.

    return {
        nodes,
        groups: {}, // Sequence usually ignores groups visually
        edges,
        width: currentX,
        height: currentY + 40
    };
}
