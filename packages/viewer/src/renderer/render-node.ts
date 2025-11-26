import { NodeLayout } from '@eraser/core';
import { IconRegistry } from '@eraser/core';

export function renderNode(node: NodeLayout): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${node.bounds.x}, ${node.bounds.y})`);

    const { width, height } = node.bounds;
    const hasFields = !!node.ast.fields?.length;
    const iconName = node.ast.attrs?.icon || (hasFields ? 'database' : null);

    // Background
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', width.toString());
    rect.setAttribute('height', height.toString());
    rect.setAttribute('rx', hasFields ? '0' : '12');
    rect.setAttribute('fill', node.ast.attrs?.color || (hasFields ? '#f9f9f9' : '#ffffff'));
    rect.setAttribute('stroke', hasFields ? '#999' : '#333');
    rect.setAttribute('stroke-width', '1.5');
    g.appendChild(rect);

    // Header for ER tables
    if (hasFields) {
        const header = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        header.setAttribute('width', width.toString());
        header.setAttribute('height', '32');
        header.setAttribute('fill', '#e0e0e0');
        g.appendChild(header);

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.textContent = node.ast.id;
        title.setAttribute('x', '12');
        title.setAttribute('y', '20');
        title.setAttribute('font-weight', 'bold');
        g.appendChild(title);
    }

    // Icon (left side)
    if (iconName && IconRegistry[iconName]) {
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        icon.setAttribute('d', IconRegistry[iconName]);
        icon.setAttribute('transform', 'translate(16, 16) scale(1.8)');
        icon.setAttribute('fill', '#555');
        g.appendChild(icon);
    }

    // Label
    const label = node.ast.attrs?.label || node.ast.id;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = label;
    text.setAttribute('x', iconName ? '56' : width / 2 + '');
    text.setAttribute('y', hasFields ? '52' : height / 2 + '');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('text-anchor', iconName ? 'start' : 'middle');
    text.setAttribute('font-size', '14px');
    text.setAttribute('fill', '#111');
    g.appendChild(text);

    // Fields (ER diagram style)
    if (hasFields) {
        node.ast.fields!.forEach((f, i) => {
            const y = 52 + (i + 1) * 24;
            const fieldText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            fieldText.textContent = `${f.name} ${f.type || ''} ${f.constraints?.join(' ') || ''}`.trim();
            fieldText.setAttribute('x', '12');
            fieldText.setAttribute('y', y.toString());
            fieldText.setAttribute('font-size', '12px');
            g.appendChild(fieldText);
        });
    }

    return g;
}
