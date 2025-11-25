import { GroupLayout } from '@eraser-renderer/core';

export function renderGroup(gNode: GroupLayout): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${gNode.bounds.x}, ${gNode.bounds.y})`);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', `${gNode.bounds.width}`);
    rect.setAttribute('height', `${gNode.bounds.height}`);
    rect.setAttribute('rx', '12');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', '#aaa');
    rect.setAttribute('stroke-dasharray', '4 4');

    g.appendChild(rect);

    if (gNode.name) {
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.textContent = gNode.name;
        title.setAttribute('x', '12');
        title.setAttribute('y', '20');
        title.setAttribute('font-size', '14px');
        title.setAttribute('font-weight', 'bold');
        g.appendChild(title);
    }

    return g;
}
