import {RoutedEdge} from "@eraser/core";
import {ViewerRenderOptions} from "@eraser/viewer";

export function renderEdge(edge: RoutedEdge, options: ViewerRenderOptions): SVGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // 1. Draw the Path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const colorStale500 = options.theme === 'dark' ? '#CBD5E1' : '#64748B';
    const colorStale600 = options.theme === 'dark' ? '#CBD5E1' : '#475569';

    // Simple L-curve smoothing could be added here,
    // but straight polylines are standard for this layout engine
    const d = edge.points
        .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
        .join(' ');

    path.setAttribute('d', d);
    path.setAttribute('stroke', colorStale500); // Slate-500
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    // Add markers based on kind
    path.setAttribute('marker-end', 'url(#arrowhead)');
    if (edge.kind === 'bidirectional') {
        path.setAttribute('marker-start', 'url(#arrowhead-start)');
    }

    group.appendChild(path);

    // 2. Draw Label (if exists)
    if (edge.label) {
        // Calculate midpoint for label
        // Simplified: just taking the middle point of the points array
        const midIndex = Math.floor(edge.points.length / 2);
        const p1 = edge.points[midIndex - 1] || edge.points[0];
        const p2 = edge.points[midIndex] || edge.points[1];

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');

        text.textContent = edge.label;
        text.setAttribute('font-size', '12');
        text.setAttribute('font-family', 'ui-sans-serif, system-ui, sans-serif');
        text.setAttribute('fill', colorStale600);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('x', midX.toString());
        text.setAttribute('y', (midY - 8).toString());

        // Approximate background rect size
        const textWidth = edge.label.length * 7 + 10;

        bg.setAttribute('x', (midX - textWidth / 2).toString());
        bg.setAttribute('y', (midY - 10).toString());
        bg.setAttribute('width', textWidth.toString());
        bg.setAttribute('height', '20');
        bg.setAttribute('fill', 'transparent');
        bg.setAttribute('rx', '4');

        group.appendChild(bg);
        group.appendChild(text);
    }

    return group;
}
