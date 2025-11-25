import { DiagramLayout } from "../types/layout-types";
import { IconRegistry } from "./icons";

export function renderToSVG(layout: DiagramLayout): string {
    const { width, height, nodes, groups, edges } = layout;

    const groupSVG = groups.map(g => `
        <rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}"
              rx="12" ry="12"
              fill="none" stroke="#b0b0b0" stroke-dasharray="6 4"/>
        <text x="${g.x + 10}" y="${g.y + 24}" font-size="14"
              fill="#666">${g.title ?? ""}</text>
    `);

    const nodeSVG = nodes.map(n => `
        <g>
            <rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}"
                  rx="10" ry="10" fill="#fff" stroke="#444"/>
            <text x="${n.x + 14}" y="${n.y + 32}" font-size="14"
                  fill="#111">${n.label}</text>
        </g>
    `);

    const edgeSVG = edges.map(e => `
        <polyline fill="none" stroke="#333" stroke-width="2"
            points="${e.points.map(p => `${p.x},${p.y}`).join(" ")}" />
    `);

    return `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}"
         xmlns="http://www.w3.org/2000/svg">
        ${groupSVG.join("\n")}
        ${nodeSVG.join("\n")}
        ${edgeSVG.join("\n")}
    </svg>
    `;
}
