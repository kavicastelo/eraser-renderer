import { DiagramAST } from '@eraser/core';

export interface ViewerRenderOptions {
    scale?: number;
    padding?: number;
    theme?: 'light' | 'dark';
    shadow?: boolean;
}

export interface ViewerRenderResult {
    svg: SVGSVGElement;
    width: number;
    height: number;
    ast: DiagramAST;
}
