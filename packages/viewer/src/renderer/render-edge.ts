import { RoutedEdge } from '@eraser/core';

export function renderEdge(edge: RoutedEdge): SVGElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const d = edge.points
        .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
        .join(' ');

    path.setAttribute('d', d);
    path.setAttribute('stroke', '#555');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrowhead)');

// Add arrowhead marker to SVG (once)
    if (!document.getElementById('arrowhead')) {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.id = 'arrowhead';
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        poly.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        poly.setAttribute('fill', '#555');
        marker.appendChild(poly);
        defs.appendChild(marker);
        document.querySelector('svg')?.appendChild(defs);
    }

    return path;
}
