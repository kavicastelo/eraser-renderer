import { DiagramAST } from '@eraser-renderer/core';

export interface ViewerRenderOptions {
    scale?: number;
    padding?: number;
    theme?: 'light' | 'dark';
}

export interface ViewerRenderResult {
    svg: SVGSVGElement;
    width: number;
    height: number;
    ast: DiagramAST;
}
