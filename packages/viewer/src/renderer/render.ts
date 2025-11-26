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

    const padding = options.padding ?? 32;
    const scale = options.scale ?? 1.0;

    const layout: LayoutResult = computeDiagramLayout(ast);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    svg.setAttribute('width', `${(layout.width + padding * 2) * scale}`);
    svg.setAttribute('height', `${(layout.height + padding * 2) * scale}`);
    svg.setAttribute('viewBox', `0 0 ${layout.width + padding * 2} ${layout.height + padding * 2}`);

    // Groups first
    Object.values(layout.groups).forEach(group => {
        svg.appendChild(renderGroup(group));
    });

    // Edges
    layout.edges.forEach(edge => {
        svg.appendChild(renderEdge(edge));
    });

    // Nodes on top
    Object.values(layout.nodes).forEach(node => {
        svg.appendChild(renderNode(node));
    });

    return {
        svg,
        width: layout.width,
        height: layout.height,
        ast
    };
}
