export type DiagramType =
    | "flow"
    | "cloud"
    | "er"
    | "sequence"
    | "bpmn"
    | "unknown";

export interface ASTDocument {
    type: DiagramType;
    title?: string;
    direction?: "right" | "left" | "down" | "up";
    blocks: ASTBlock[];
    edges: ASTEdge[];
}

export interface ASTBlock {
    kind: "node" | "group" | "store" | "actor" | "process";
    id: string;
    label?: string;
    icon?: string;
    color?: string;
    shape?: string;
    children?: ASTBlock[];
}

export interface ASTEdge {
    from: string;
    to: string;
    bidirectional?: boolean;
    label?: string | null;
}
