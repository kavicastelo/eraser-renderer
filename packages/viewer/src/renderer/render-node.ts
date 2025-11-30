import { FieldDef, NodeLayout } from '@eraser/core';
import { IconRegistry } from './icons';
import { resolveColor, ColorMode } from './colors';
import { ViewerRenderOptions } from '@eraser/viewer';

export function renderNode(node: NodeLayout, options: ViewerRenderOptions, metadata: any, diagramHeight: number): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${node.bounds.x}, ${node.bounds.y})`);

    const { width, height } = node.bounds;
    const hasFields = !!node.ast.fields?.length;

    // 1. Resolve Style & Color
    // Priority: Node Attribute > Diagram Metadata > Default
    const colorKey = node.ast.attrs?.color;
    const mode: ColorMode = (node.ast.attrs?.colorMode as ColorMode) || (metadata?.colorMode as ColorMode) ||
        (options.theme === 'dark' ? 'solid' : 'pastel');

    const colors = resolveColor(colorKey, mode, options.theme || 'light');

    // 2. Icon Logic
    const iconName = node.ast.attrs?.icon || '';
    const hasIcon = !!iconName && !!IconRegistry[iconName];

    const isSequence = options.diagramType === 'sequence';
    const isBPMN = options.diagramType === 'bpmn';

    if (isBPMN) {
        return renderBPMNNode(node, options, colors);
    }

    // -- Sequence Lifeline --
    if (isSequence) {
        const lifeline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const centerX = node.bounds.width / 2;
        lifeline.setAttribute('x1', `${centerX}`);
        lifeline.setAttribute('y1', `${node.bounds.height}`);
        // Draw to bottom of diagram
        lifeline.setAttribute('x2', `${centerX}`);
        lifeline.setAttribute('y2', `${diagramHeight - node.bounds.y}`);
        lifeline.setAttribute('stroke', colors.border);
        lifeline.setAttribute('stroke-width', '2');
        lifeline.setAttribute('stroke-dasharray', '6 4');
        lifeline.setAttribute('opacity', '0.5');
        g.appendChild(lifeline);
    }

    // 3. Main Container (Card)
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', width.toString());
    rect.setAttribute('height', height.toString());
    rect.setAttribute('rx', '8');

    // Apply Colors
    rect.setAttribute('fill', colors.bg);
    rect.setAttribute('stroke', colors.border);
    rect.setAttribute('stroke-width', '2');

    // Apply Drop Shadow if requested (usually for 'clean' style)
    if (options.shadow !== false) {
        rect.setAttribute('filter', 'url(#shadow-sm)');
    }

    g.appendChild(rect);

    // 4. Header / Content Layout

    // If it's an ER Diagram table (has fields)
    if (hasFields) {
        renderEntityWithFields(g, node, width, height, colors, hasIcon, iconName);
    } else {
        // Simple Node
        renderSimpleNode(g, node, width, height, colors, hasIcon, iconName);
    }

    return g;
}

function renderSimpleNode(
    g: SVGElement,
    node: NodeLayout,
    width: number,
    height: number,
    colors: any,
    hasIcon: boolean,
    iconName?: string
) {
    const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Icon Rendering
    if (hasIcon && iconName) {
        renderFloatingIcon(g, colors, iconName);
    }

    // Label Rendering
    const label = node.ast.attrs?.label || node.ast.id;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = label;

    text.setAttribute('font-family', 'ui-sans-serif, system-ui, sans-serif');
    text.setAttribute('font-size', '14');
    text.setAttribute('font-weight', '600');
    text.setAttribute('fill', colors.fg);
    text.setAttribute('dominant-baseline', 'middle');

    if (hasIcon) {
        text.setAttribute("x", "16");
    } else {
        text.setAttribute("x", (width / 2).toString());
        text.setAttribute('text-anchor', 'middle');
    }

    text.setAttribute('y', (height / 2).toString());

    textGroup.appendChild(text);
    g.appendChild(textGroup);
}

function renderEntityWithFields(
    g: SVGElement,
    node: NodeLayout,
    width: number,
    height: number,
    colors: any,
    hasIcon: boolean,
    iconName?: string
) {
    const headerHeight = 40;

    // Header Background (if we want a split header look, currently using solid bg for whole node)
    // Let's add a divider line instead
    const divider = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    divider.setAttribute('x1', '0');
    divider.setAttribute('y1', headerHeight.toString());
    divider.setAttribute('x2', width.toString());
    divider.setAttribute('y2', headerHeight.toString());
    divider.setAttribute('stroke', colors.border);
    divider.setAttribute('stroke-width', '1');
    g.appendChild(divider);

    // Header Icon
    if (hasIcon && iconName) {
        renderFloatingIcon(g, colors, iconName);
    }

    // Header Title
    const label = node.ast.attrs?.label || node.ast.id;
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.textContent = label;
    title.setAttribute('x', hasIcon ? '44' : '16');
    title.setAttribute('y', '25'); // Approx middle of 40px
    title.setAttribute('font-family', 'ui-sans-serif, system-ui, sans-serif');
    title.setAttribute('font-size', '14');
    title.setAttribute('font-weight', '700');
    title.setAttribute('fill', colors.fg);
    g.appendChild(title);

    // Fields
    if (node.ast.fields) {
        const fieldGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        fieldGroup.setAttribute('transform', `translate(0, ${headerHeight})`);

        node.ast.fields.forEach((f: FieldDef, i: number) => {
            const rowY = 24 + (i * 24); // 24px per row

            const fieldText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            fieldText.setAttribute('x', '16');
            fieldText.setAttribute('y', rowY.toString());
            fieldText.setAttribute('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');
            fieldText.setAttribute('font-size', '12');
            fieldText.setAttribute('fill', colors.fg); // Or a slightly lighter shade

            // Visibility
            let prefix = '';
            if (f.visibility === 'public') prefix = '+ ';
            else if (f.visibility === 'private') prefix = '- ';
            else if (f.visibility === 'protected') prefix = '# ';
            else if (f.visibility === 'package') prefix = '~ ';

            // Name
            const nameSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            nameSpan.textContent = prefix + f.name;
            nameSpan.setAttribute('font-weight', '600');
            if (f.memberType === 'method') {
                nameSpan.textContent += '()'; // Simple addition if parens missing, though parser usually keeps them
            }

            // Type
            const typeSpan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            typeSpan.textContent = f.type ? `: ${f.type}` : '';
            typeSpan.setAttribute('opacity', '0.7');

            fieldText.appendChild(nameSpan);
            fieldText.appendChild(typeSpan);

            fieldGroup.appendChild(fieldText);
        });
        g.appendChild(fieldGroup);
    }
}

function renderFloatingIcon(
    parent: SVGElement,
    colors: any,
    iconName: string
) {
    const ICON_SIZE = 20;
    const PAD = 2;
    const RADIUS = 3;

    const iconGroup = document.createElementNS('http://www.w3.org/2000/svg', "g");
    iconGroup.setAttribute("transform", `translate(${-ICON_SIZE / 2}, ${-ICON_SIZE / 2})`);

    // Icon container
    const box = document.createElementNS('http://www.w3.org/2000/svg', "rect");
    box.setAttribute("width", ICON_SIZE.toString());
    box.setAttribute("height", ICON_SIZE.toString());
    box.setAttribute("rx", RADIUS.toString());
    box.setAttribute("fill", colors.bg);
    box.setAttribute("stroke", colors.border);
    box.setAttribute("stroke-width", "1.2");

    // Actual icon (path)
    const iconPath = IconRegistry[iconName];
    const icon = document.createElementNS('http://www.w3.org/2000/svg', "path");
    icon.setAttribute("d", iconPath);
    icon.setAttribute("fill", colors.fg);

    // Center icon inside box
    const inner = ICON_SIZE - PAD * 2;
    icon.setAttribute(
        "transform",
        `translate(${PAD}, ${PAD}) scale(${inner / 24})`
    );

    iconGroup.appendChild(box);
    iconGroup.appendChild(icon);
    parent.appendChild(iconGroup);
}

function renderBPMNNode(node: NodeLayout, options: ViewerRenderOptions, colors: any): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${node.bounds.x}, ${node.bounds.y})`);

    const type = node.ast.attrs.type || 'task';
    const { width, height } = node.bounds;

    if (type === 'event' || type === 'start' || type === 'end') {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const r = Math.min(width, height) / 2;
        circle.setAttribute('cx', (width / 2).toString());
        circle.setAttribute('cy', (height / 2).toString());
        circle.setAttribute('r', r.toString());
        circle.setAttribute('fill', colors.bg);
        circle.setAttribute('stroke', colors.border);
        circle.setAttribute('stroke-width', type === 'end' ? '4' : '2');
        g.appendChild(circle);
    } else if (type === 'gateway') {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        // Diamond shape
        const points = `${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}`;
        polygon.setAttribute('points', points);
        polygon.setAttribute('fill', colors.bg);
        polygon.setAttribute('stroke', colors.border);
        polygon.setAttribute('stroke-width', '2');
        g.appendChild(polygon);
    } else {
        // Task (Rounded Rect)
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', width.toString());
        rect.setAttribute('height', height.toString());
        rect.setAttribute('rx', '8');
        rect.setAttribute('fill', colors.bg);
        rect.setAttribute('stroke', colors.border);
        rect.setAttribute('stroke-width', '2');
        g.appendChild(rect);
    }

    // Label
    const label = node.ast.attrs?.label || node.ast.id;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = label;
    text.setAttribute('x', (width / 2).toString());
    text.setAttribute('y', (height / 2).toString());
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-family', 'ui-sans-serif, system-ui, sans-serif');
    text.setAttribute('font-size', '12');
    text.setAttribute('fill', colors.fg);
    g.appendChild(text);

    return g;
}
