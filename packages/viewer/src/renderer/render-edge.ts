import { RoutedEdge } from '@eraser/core';

export function renderEdge(edge: RoutedEdge): SVGElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const d = edge.points
        .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
        .join(' ');

    path.setAttribute('d', d);
    path.setAttribute('stroke', '#333');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');

    return path;
}
