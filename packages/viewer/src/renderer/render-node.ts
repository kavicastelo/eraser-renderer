import { NodeLayout } from '@eraser-renderer/core';

export function renderNode(node: NodeLayout): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${node.bounds.x}, ${node.bounds.y})`);

    // background
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', `${node.bounds.width}`);
    rect.setAttribute('height', `${node.bounds.height}`);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', node.ast.attrs.color ?? '#fff');
    rect.setAttribute('stroke', '#222');
    rect.setAttribute('stroke-width', '1.5');
    g.appendChild(rect);

    // label text
    if (node.label) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.textContent = node.label;
        text.setAttribute('x', `${node.bounds.width / 2}`);
        text.setAttribute('y', `${node.bounds.height / 2}`);
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '14px');
        g.appendChild(text);
    }

    return g;
}
