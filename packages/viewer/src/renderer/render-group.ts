import { GroupLayout } from '@eraser/core';
import {ViewerRenderOptions} from "@eraser/viewer";

export function renderGroup(gNode: GroupLayout, options: ViewerRenderOptions): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${gNode.bounds.x}, ${gNode.bounds.y})`);

    const colorStale500 = options.theme === 'dark' ? '#CBD5E1' : '#64748B';
    const colorStale300 = options.theme === 'dark' ? '#CBD5E1' : '#CBD5E1';
    const veryLightSlate = options.theme === 'dark' ? 'rgba(241, 245, 249, 0.1)' : 'rgba(241, 245, 249, 0.4)';

    // Group Background / Border
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', `${gNode.bounds.width}`);
    rect.setAttribute('height', `${gNode.bounds.height}`);
    rect.setAttribute('rx', '8');
    rect.setAttribute('fill', veryLightSlate); // Very light slate transparent
    rect.setAttribute('stroke', colorStale300); // Slate-300
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('stroke-dasharray', '6 4'); // Dashed line

    g.appendChild(rect);

    // Group Label
    if (gNode.name) {
        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.textContent = gNode.name.toUpperCase();
        text.setAttribute('x', '16');
        text.setAttribute('y', '24');
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', '700');
        text.setAttribute('font-family', 'ui-sans-serif, system-ui, sans-serif');
        text.setAttribute('fill', colorStale500); // Slate-500
        text.setAttribute('letter-spacing', '0.05em');

        labelGroup.appendChild(text);
        g.appendChild(labelGroup);
    }

    return g;
}
