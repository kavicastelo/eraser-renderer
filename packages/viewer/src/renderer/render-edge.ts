import { RoutedEdge, Point } from "@eraser/core";
import { ViewerRenderOptions } from "@eraser/viewer";

export function renderEdge(edge: RoutedEdge, options: ViewerRenderOptions): SVGElement {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const color = options.theme === 'dark' ? '#94A3B8' : '#64748B'; // Slate 400/500

    // Generate Rounded Path
    const d = getRoundedPath(edge.points, 8); // 8px radius

    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');

    // Markers
    path.setAttribute('marker-end', 'url(#arrowhead)');
    if (edge.kind === 'bidirectional' || edge.kind === 'undirected') {
        // Note: undirected usually has no markers, bidirectional has start
        if (edge.kind === 'bidirectional') path.setAttribute('marker-start', 'url(#arrowhead-start)');
    }

    group.appendChild(path);

    // Label Rendering (With background pill)
    if (edge.label) {
        const midIdx = Math.floor(edge.points.length / 2);
        // Find visual center of the middle segment
        const p1 = edge.points[midIdx - 1] || edge.points[0];
        const p2 = edge.points[midIdx] || edge.points[1];

        const x = (p1.x + p2.x) / 2;
        const y = (p1.y + p2.y) / 2;

        const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const paddingX = 8;
        const paddingY = 4;

        // Approximate text width (or measure if available)
        const charWidth = 7;
        const bgWidth = (edge.label.length * charWidth) + (paddingX * 2);
        const bgHeight = 20;

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('x', `${x - bgWidth/2}`);
        bg.setAttribute('y', `${y - bgHeight/2}`);
        bg.setAttribute('width', `${bgWidth}`);
        bg.setAttribute('height', `${bgHeight}`);
        bg.setAttribute('rx', '4');
        bg.setAttribute('fill', options.theme === 'dark' ? '#1E293B' : '#FFFFFF');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.textContent = edge.label;
        text.setAttribute('x', `${x}`);
        text.setAttribute('y', `${y}`);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', color);
        text.setAttribute('font-size', '11');
        text.setAttribute('font-family', 'ui-sans-serif, system-ui');

        textGroup.appendChild(bg);
        textGroup.appendChild(text);
        group.appendChild(textGroup);
    }

    return group;
}

/**
 * Smoothing function for Dagre poly-lines
 */
function getRoundedPath(points: Point[], radius: number): string {
    if (points.length < 3) {
        return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length - 1; i++) {
        const p0 = points[i - 1];
        const p1 = points[i];     // The corner
        const p2 = points[i + 1];

        // Vector logic to find start/end of curve
        // Simplified: We assume dagre gives us mostly orthogonal lines
        // so we just back off by 'radius' from p1 towards p0, and p1 towards p2

        // This is a naive implementation; rigorous vector math is better but verbose
        // Assuming mostly straight lines:

        d += ` L ${p1.x} ${p1.y}`;
        // Ideally: calculate vector, subtract radius, LineTo start, QuadTo p1 end
    }

    // Better approach for generic points (Chaikin's Algorithm simplified):
    // Or just simple Quadratic Bezier between midpoints
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const pCurrent = points[i];
        const pNext = points[i+1];

        // If it's a long segment, draw line. If it's a bend...
        // Actually, easiest aesthetic smoothing:
        // Draw line to midpoint of segment, then curve to midpoint of next?

        // Let's stick to standard SVG Polyline for robustness if math is heavy,
        // OR use a basis curve if you want organic look.
        // For technical diagrams, "Rounded Orthogonal" is best.

        path += ` L ${pNext.x} ${pNext.y}`;
    }

    // Implementation of Radius Rounding:
    // Move to P0
    // Line to (P1 - radius)
    // Curve via P1 to (P1 + radius) ...

    return generateRoundedCornerPath(points, radius);
}

function generateRoundedCornerPath(points: Point[], r: number): string {
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];

        // Calculate vectors
        const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
        const v2 = { x: next.x - curr.x, y: next.y - curr.y };

        const len1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y);
        const len2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y);

        // Clamp radius to not exceed half the segment length
        const effectiveR = Math.min(r, len1/2, len2/2);

        // Normalize and scale
        const off1 = { x: curr.x + (v1.x/len1) * effectiveR, y: curr.y + (v1.y/len1) * effectiveR };
        const off2 = { x: curr.x + (v2.x/len2) * effectiveR, y: curr.y + (v2.y/len2) * effectiveR };

        d += ` L ${off1.x} ${off1.y}`;
        d += ` Q ${curr.x} ${curr.y} ${off2.x} ${off2.y}`;
    }

    d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
    return d;
}
