export type DiagramType = 'flow' | 'cloud' | 'er' | 'sequence' | 'bpmn' | 'class' | 'graph' | 'architecture' | 'unknown';

export interface DiagramAST {
    diagramType: DiagramType;
    metadata: Record<string, string | boolean>;
    rootBlocks: BlockNode[];
    edges: EdgeNode[];
    rawLineCount: number;
}

export type BlockNode = GroupNode | EntityNode;

// -------- Groups --------
export interface GroupNode {
    kind: 'group';
    name: string;
    children: BlockNode[];
    attrs?: Record<string, string>;
}

// -------- Entities --------
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
    constraints?: string[];
    memberType?: 'field' | 'method';
    visibility?: 'public' | 'private' | 'protected' | 'package';
    raw?: string;
}

// -------- Edges --------
export type EdgeKind = 'directed' | 'undirected' | 'bidirectional';

export interface EdgeNode {
    from: string;
    to: string;
    kind: EdgeKind;
    label?: string;
    cardinality?: {
        from?: string; // e.g. "1", "0..1", "*"
        to?: string;   // e.g. "1", "0..1", "*"
    };
    raw?: string;
}

// ============================
// Layout-friendly aliases
// ============================

export type ASTNode = EntityNode;      // Nodes that appear visually as boxes
export type ASTGroup = GroupNode;      // Groups of nodes
export type ASTEdge = EdgeNode;        // Routed edges

// Optional helper if needed:
export interface FlattenedAST {
    nodes: ASTNode[];
    groups: ASTGroup[];
    edges: ASTEdge[];
}
