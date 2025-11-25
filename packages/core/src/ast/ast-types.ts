export type DiagramType = 'flow' | 'cloud' | 'er' | 'sequence' | 'bpmn' | 'unknown';

export interface DiagramAST {
    diagramType: DiagramType;
    metadata: Record<string, string | boolean>;
    rootBlocks: BlockNode[];     // top-level groups and nodes
    edges: EdgeNode[];           // all parsed edges (chains expanded)
    rawLineCount: number;
}

export type BlockNode = GroupNode | EntityNode;

export interface GroupNode {
    kind: 'group';
    name: string;
    children: BlockNode[];
    attrs?: Record<string, string>;
}

export interface EntityNode {
    kind: 'entity';
    id: string;
    attrs: Record<string, string>;
    fields?: FieldDef[];
    raw?: string;
}

export interface FieldDef {
    name: string;
    type?: string;
    constraints?: string[]; // pk, fk, nullable, etc.
    raw?: string;
}

export type EdgeKind = 'directed' | 'undirected' | 'bidirectional';

export interface EdgeNode {
    from: string;
    to: string;
    kind: EdgeKind;
    label?: string;
    raw?: string;
}
