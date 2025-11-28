import { ViewerRenderResult, ViewerRenderOptions } from '../types/viewer-types';
import { renderNode } from './render-node';
import { renderGroup } from './render-group';
import { renderEdge } from './render-edge';
import { DiagramAST, LayoutResult } from "@eraser/core";
import {computeGraphLayout} from "../layout/dagre-layout";
import {computeSequenceLayout} from "../layout/sequence-layout";

export function renderToSVGElement(
    ast: DiagramAST,
    options: ViewerRenderOptions = {}
): ViewerRenderResult {

    // 1. SELECT LAYOUT ENGINE
    const padding = options.padding ?? 40;
    const scale = options.scale ?? 1.0;
    let layout: LayoutResult;

    if (ast.diagramType === 'sequence') {
        layout = computeSequenceLayout(ast);
        options.diagramType = 'sequence'; // Pass down to node renderer
    } else {
        layout = computeGraphLayout(ast); // Using the Fixed Dagre engine
        options.diagramType = 'graph';
    }

    const totalWidth = layout.width + padding * 2;
    const totalHeight = layout.height + padding * 2;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', `${totalWidth * scale}`);
    svg.setAttribute('height', `${totalHeight * scale}`);
    svg.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
    switch (ast.metadata.typeface) {
        case 'serif':
            svg.style.fontFamily = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
            break;
        case 'sans-serif':
            svg.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
            break;
        case 'monospace':
            svg.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
            break;
        case 'cursive':
            svg.style.fontFamily = 'cursive';
            break;
        case 'clean':
            svg.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
            break;
        default:
            svg.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
            break;
    }

    svg.appendChild(createDefs());

    const content = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    content.setAttribute('transform', `translate(${padding}, ${padding})`);

    // Render Groups (Background)
    if (ast.diagramType !== 'sequence') {
        Object.values(layout.groups).forEach(g => content.appendChild(renderGroup(g, options)));
    }

    // Render Nodes (with Lifelines if sequence)
    // Note: For sequence, nodes usually go ON TOP of lifelines, but lifelines go BEHIND edges.
    // Order: Lifelines -> Edges -> Node Headers

    // Ideally, split node render into (Lifeline) and (Header).
    // For simplicity, we render nodes first (if graph) or specifically ordered (if sequence).

    if (ast.diagramType === 'sequence') {
        // Draw Nodes (headers + lifelines)
        Object.values(layout.nodes).forEach(node => {
            content.appendChild(renderNode(node, options, ast.metadata, layout.height));
        });
        // Draw Edges (on top of lifelines)
        layout.edges.forEach(edge => {
            content.appendChild(renderEdge(edge, options));
        });
    } else {
        // Standard Graph Order
        layout.edges.forEach(e => content.appendChild(renderEdge(e, options)));
        Object.values(layout.nodes).forEach(n => content.appendChild(renderNode(n, options, ast.metadata, 0)));
    }

    svg.appendChild(content);

    return { svg, width: totalWidth, height: totalHeight, ast };
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
