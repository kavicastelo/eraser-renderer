import { ASTNode, ASTGroup, ASTEdge } from "../ast/ast-types";

/* ===============================================
 * Layout Primitive Types
 * =============================================== */

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/* ===============================================
 * Node Layout
 * =============================================== */

export interface NodeLayout {
    id: string;

    // Absolute position & size
    bounds: Rect;

    // Derived from AST
    ast: ASTNode;

    // Optional for renderers
    label?: string;
    ports?: PortLayout[];
}

export interface PortLayout {
    id: string;
    position: Point; // absolute
}

/* ===============================================
 * Group Layout
 * =============================================== */

export interface GroupLayout {
    name: string;

    // Absolute group bounds (auto-expanded from children)
    bounds: Rect;

    // Parent/child relationships
    ast: ASTGroup;
    children: string[]; // child node ids

    padding: number; // default 16
}

/* ===============================================
 * Edge Routing Layout
 * =============================================== */

export interface RoutedEdge {
    id: string;
    from: string; // node id
    to: string;   // node id

    kind: ASTEdge["kind"];

    points: Point[]; // polyline through ports → bends → ports
    label?: string;

    ast: ASTEdge;
}

/* ===============================================
 * Final Layout Output
 * =============================================== */

export interface DiagramLayout {
    nodes: Record<string, NodeLayout>;
    groups: Record<string, GroupLayout>;
    edges: RoutedEdge[];

    // Useful for zoom-to-fit
    bounds: Rect;
}
