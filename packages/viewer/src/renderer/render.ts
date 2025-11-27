import { ViewerRenderResult, ViewerRenderOptions } from '../types/viewer-types';
import { renderNode } from './render-node';
import { renderGroup } from './render-group';
import { renderEdge } from './render-edge';
import { DiagramAST, LayoutResult } from "@eraser/core";
import {computeDiagramLayout} from "../layout/dagre-layout";

export function renderToSVGElement(
    ast: DiagramAST,
    options: ViewerRenderOptions = {}
): ViewerRenderResult {

    const padding = options.padding ?? 40;
    const scale = options.scale ?? 1.0;

    // 1. Compute Layout
    const layout: LayoutResult = computeDiagramLayout(ast);

    // 2. Setup SVG Container
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const totalWidth = layout.width + padding * 2;
    const totalHeight = layout.height + padding * 2;

    svg.setAttribute('width', `${totalWidth * scale}`);
    svg.setAttribute('height', `${totalHeight * scale}`);
    svg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
    svg.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    // 3. Inject Global Defs (Markers, Filters)
    svg.appendChild(createDefs());

    // 4. Content Container (Applied padding)
    const content = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    content.setAttribute('transform', `translate(${padding}, ${padding})`);

    // 5. Render Layers (Groups -> Edges -> Nodes)

    // Groups (Background layer)
    Object.values(layout.groups).forEach(group => {
        content.appendChild(renderGroup(group, options));
    });

    // Edges (Middle layer)
    layout.edges.forEach(edge => {
        content.appendChild(renderEdge(edge, options));
    });

    // Nodes (Top layer)
    Object.values(layout.nodes).forEach(node => {
        content.appendChild(renderNode(node, options));
    });

    svg.appendChild(content);

    return {
        svg,
        width: totalWidth,
        height: totalHeight,
        ast
    };
}

/**
 * Creates SVG definitions for reuse (Arrowheads, Drop Shadows)
 */
function createDefs(): SVGDefsElement {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // -- Arrowhead (End) --
    const markerEnd = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    markerEnd.id = 'arrowhead';
    markerEnd.setAttribute('viewBox', '0 0 10 10');
    markerEnd.setAttribute('refX', '9');
    markerEnd.setAttribute('refY', '5');
    markerEnd.setAttribute('markerWidth', '6');
    markerEnd.setAttribute('markerHeight', '6');
    markerEnd.setAttribute('orient', 'auto-start-reverse');

    const pathEnd = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEnd.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    pathEnd.setAttribute('fill', '#64748B'); // Slate-500
    markerEnd.appendChild(pathEnd);
    defs.appendChild(markerEnd);

    // -- Arrowhead (Start) - for bidirectional --
    const markerStart = markerEnd.cloneNode(true) as SVGElement;
    markerStart.id = 'arrowhead-start';
    // Logic handled by orient="auto-start-reverse", but explicit ID needed for reference
    defs.appendChild(markerStart);

    // -- Drop Shadow (Small) --
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.id = 'shadow-sm';
    filter.setAttribute('x', '-20%');
    filter.setAttribute('y', '-20%');
    filter.setAttribute('width', '140%');
    filter.setAttribute('height', '140%');

    const feDropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
    feDropShadow.setAttribute('dx', '0');
    feDropShadow.setAttribute('dy', '2');
    feDropShadow.setAttribute('stdDeviation', '2'); // Blur
    feDropShadow.setAttribute('flood-color', '#000000');
    feDropShadow.setAttribute('flood-opacity', '0.06'); // Very subtle

    filter.appendChild(feDropShadow);
    defs.appendChild(filter);

    return defs;
}
