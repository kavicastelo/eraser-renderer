import { tokenize } from "../lexer/tokenize";
import { Token } from "../lexer/token-types";
import {
    DiagramAST,
    DiagramType,
    BlockNode,
    EntityNode,
    GroupNode,
    FieldDef,
    EdgeNode,
} from "../types-bridge";

type DSLMode = 'eraser' | 'plantuml' | 'mermaid';

class Parser {
    tokens: Token[];
    pos: number;
    dslMode: DSLMode = 'eraser'; // Default
    diagramType: DiagramType = 'unknown';

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.pos = 0;
        this.detectDSL();
    }

    // 1. Detect DSL Language before parsing
    detectDSL() {
        // Scan first 10 significant tokens
        let lookaheadLimit = 10;
        let i = 0;
        while(i < this.tokens.length && i < lookaheadLimit) {
            const t = this.tokens[i];

            // PlantUML: starts with @startuml
            if (t.type === 'AT' && this.tokens[i+1]?.text === 'startuml') {
                this.dslMode = 'plantuml';
                return;
            }

            // Mermaid: starts with specific keywords
            if (t.type === 'IDENT') {
                const txt = t.text.toLowerCase();
                if (['graph', 'flowchart', 'sequencediagram', 'classdiagram'].includes(txt)) {
                    this.dslMode = 'mermaid';
                    return;
                }
            }
            i++;
        }
        // Default to Eraser if no specific headers found
        this.dslMode = 'eraser';
    }

    peek(n = 0): Token {
        if (this.tokens.length === 0) return { type: 'EOF', text: '', line: 0, col: 0 };
        return this.tokens[this.pos + n] ?? this.tokens[this.tokens.length - 1];
    }

    next(): Token {
        const t = this.peek();
        if (t.type !== 'EOF') this.pos++;
        return t;
    }

    expect(type: Token['type'], consume = true): Token | null {
        const t = this.peek();
        if (t.type === type) {
            if (consume) this.next();
            return t;
        }
        return null;
    }

    consumeIf(type: Token['type']): Token | null {
        const t = this.peek();
        if (t.type === type) { this.next(); return t; }
        return null;
    }

    eof(): boolean {
        return this.peek().type === 'EOF';
    }

    parse(): DiagramAST {
        const metadata: Record<string, string | boolean> = {};
        const rootBlocks: BlockNode[] = [];
        const edges: EdgeNode[] = [];
        const lineCount = this.tokens.reduce((acc, t) => Math.max(acc, t.line), 0);

        // Skip PlantUML header
        if (this.dslMode === 'plantuml') {
            if (this.peek().type === 'AT') { this.next(); this.consumeIf('IDENT'); } // Skip @startuml
        }
        // Skip Mermaid header (e.g. "graph TD")
        if (this.dslMode === 'mermaid') {
            if (this.peek().type === 'IDENT') {
                // Consume "graph TD" or "sequenceDiagram"
                const first = this.next();
                // If next is TD/LR etc, consume it
                if (this.peek().type === 'IDENT' && first.line === this.peek().line) {
                    this.next();
                }
            }
        }

        while (!this.eof()) {
            const t = this.peek();

            // Skip comments/newlines
            if (t.type === 'NEWLINE' || t.type === 'OTHER') { this.next(); continue; }

            // Stop at PlantUML end
            if (this.dslMode === 'plantuml' && t.type === 'AT' && this.peek(1).text === 'enduml') {
                break;
            }

            if (t.type === 'IDENT') {
                const next1 = this.peek(1);
                const next2 = this.peek(2);

                // --- GROUPS ---
                // Eraser: "group Name {"
                // PlantUML: "package Name {" or "node Name {"
                // Mermaid: "subgraph Name"
                const isEraserGroup = t.text.toLowerCase() === 'group';
                const isPlantUmlGroup = this.dslMode === 'plantuml' &&
                    ['package', 'node', 'cloud', 'database', 'rectangle', 'folder', 'frame'].includes(t.text.toLowerCase());
                const isMermaidGroup = this.dslMode === 'mermaid' && t.text.toLowerCase() === 'subgraph';

                if ((isEraserGroup || isPlantUmlGroup || isMermaidGroup) &&
                    (next1?.type === 'IDENT' || next1?.type === 'STRING')) {

                    this.next(); // consume keyword
                    let nameTok = this.peek();
                    if(nameTok.type === 'IDENT' || nameTok.type === 'STRING') this.next();
                    else nameTok = { ...t, text: 'group' }; // fallback

                    const group = this.parseGroup(nameTok.text);
                    rootBlocks.push(group);
                    continue;
                }

                // --- BLOCKS WITH BRACES ---
                // Name { ... }
                if (next1?.type === 'LBRACE') {
                    if (this.looksLikeEntityDef()) {
                        rootBlocks.push(this.parseEntityOrNode());
                    } else {
                        rootBlocks.push(this.parseGroup());
                    }
                    continue;
                }

                // --- MERMAID NODES WITH SHAPES ---
                // id[Label] or id(Label) -- handled in parseEntityOrNode logic usually,
                // but we trigger it here if we see `id[`
                if (next1?.type === 'LBRACK') {
                    rootBlocks.push(this.parseEntityOrNode());
                    continue;
                }

                // --- EDGES OR LONE NODES ---
                if (this.looksLikeEdgeLine()) {
                    edges.push(...this.parseEdgeLine());
                    continue;
                }

                // Metadata: key value (Only strict in Eraser, loose in others)
                if (this.dslMode === 'eraser') {
                    const meta = this.parseMetadataLine();
                    if (meta) {
                        metadata[meta.key] = meta.value;
                        continue;
                    }
                }

                // Lone identifier / Node
                const idTok = this.next();

                // Check if PlantUML "class Name"
                if (this.dslMode === 'plantuml' && ['class', 'interface', 'entity'].includes(idTok.text.toLowerCase())) {
                    const actualName = this.expect('IDENT');
                    if (actualName) {
                        rootBlocks.push(this.parseEntityOrNode(actualName.text));
                        continue;
                    }
                }

                rootBlocks.push({
                    kind: 'entity',
                    id: idTok.text,
                    attrs: {},
                    raw: idTok.text
                } as EntityNode);

                // Fast forward to end of line to prevent re-parsing same tokens
                while (!this.eof() && this.peek().type !== 'NEWLINE') {
                    // Safety check for inline edges in Mermaid: A --> B
                    if(this.looksLikeEdgeLine()) {
                        // Backtrack one token so the edge parser picks up the 'A'
                        this.pos--;
                        edges.push(...this.parseEdgeLine());
                        break;
                    }
                    this.next();
                }
                continue;
            }

            if (this.looksLikeEdgeLine()) {
                edges.push(...this.parseEdgeLine());
                continue;
            }

            this.next();
        }

        this.diagramType = this.inferDiagramType(rootBlocks, edges, metadata);

        return {
            diagramType: this.diagramType,
            metadata,
            rootBlocks,
            edges,
            rawLineCount: lineCount
        };
    }

    private inferDiagramType(rootBlocks: BlockNode[], edges: EdgeNode[], metadata: Record<string, string | boolean>): DiagramType {
        if (this.dslMode === 'mermaid') {
            // Try to refine generic mermaid to sequence/flow
            const hasSeq = edges.some(e => ['->>', '-->>'].includes(e.raw || ''));
            if (hasSeq) return 'sequence';
            return 'flow';
        }
        if (this.dslMode === 'plantuml') return 'class'; // Default assumption for PUML, logic can be improved

        // Existing heuristics for Eraser...
        if (metadata['type'] && typeof metadata['type'] === 'string') return metadata['type'] as DiagramType;
        let hasFields = false;
        const visit = (node: BlockNode) => {
            if (node.kind === 'entity' && node.fields && node.fields.length > 0) hasFields = true;
            if (node.kind === 'group') node.children.forEach(visit);
        };
        rootBlocks.forEach(visit);
        if (hasFields) return 'er';
        if (edges.length > 0) return 'flow';
        return 'unknown';
    }

    looksLikeEntityDef(): boolean {
        let i = 2;
        while (true) {
            const t = this.peek(i);
            if (!t || t.type === 'EOF' || t.type === 'RBRACE') return false;
            if (t.type === 'NEWLINE' || t.type === 'OTHER') { i++; continue; }
            break;
        }
        const t1 = this.peek(i);
        const t2 = this.peek(i + 1);
        return t1.type === 'IDENT' && (t2.type === 'IDENT' || t2.type === 'STRING' || t2.type === 'LBRACK');
    }

    looksLikeEdgeLine(): boolean {
        let i = 0;
        while (true) {
            const t = this.peek(i);
            if (!t || t.type === 'EOF' || t.type === 'NEWLINE') return false;
            // Support arrows, dashes, and Mermaid pipes for labels
            if ([ 'GT', 'GT_LT', 'ARROW', 'DASH' ].includes(t.type)) return true;
            i++;
        }
    }

    parseMetadataLine(): { key: string; value: string | boolean } | null {
        const keyTok = this.consumeIf('IDENT');
        if (!keyTok) return null;

        // Eraser metadata is usually strict: "key value" on a single line
        // We peek to ensure it looks like metadata and not an edge "A -> B"
        if(this.looksLikeEdgeLine()) return null;

        const pieces: string[] = [];
        while (!this.eof() && this.peek().type !== 'NEWLINE') {
            pieces.push(this.next().text);
        }
        if (this.peek().type === 'NEWLINE') this.next();
        const value = pieces.join(' ').trim();
        return { key: keyTok.text, value: value === '' ? true : value };
    }

    parseGroup(explicitName?: string): GroupNode {
        let name = explicitName || 'group';
        this.consumeIf('LBRACE');

        const children: BlockNode[] = [];
        while (!this.eof() && this.peek().type !== 'RBRACE') {
            // For Mermaid 'end' keyword closing a subgraph
            if (this.dslMode === 'mermaid' && this.peek().text.toLowerCase() === 'end') {
                this.next();
                break;
            }

            if (this.peek().type === 'NEWLINE' || this.peek().type === 'OTHER') { this.next(); continue; }

            // Recurse parsing logic (simplified for brevity)
            if (this.peek().type === 'IDENT') {
                children.push(this.parseEntityOrNode());
            } else {
                this.next();
            }
        }
        if (this.peek().type === 'RBRACE') this.next();
        return { kind: 'group', name, children };
    }

    // Pass optional ID if pre-parsed (e.g. "class MyClass")
    parseEntityOrNode(preParsedId?: string): EntityNode {
        let id = preParsedId;
        if (!id) {
            const idTok = this.expect('IDENT');
            id = idTok ? idTok.text : 'node';
        }

        const attrs: Record<string, string> = {};
        let fields: FieldDef[] | undefined;

        // --- CONFLICT RESOLUTION: Square Brackets ---
        if (this.peek().type === 'LBRACK') {
            this.next(); // eat [

            if (this.dslMode === 'eraser') {
                // Eraser: [key: val, color: red]
                const pairs = this.collectUntil('RBRACK');
                Object.assign(attrs, this.tokensToKeyValues(pairs));
            } else {
                // Mermaid/PlantUML: [Label Text]
                // Treat the entire content as a 'label' attribute
                const content: string[] = [];
                while(!this.eof() && this.peek().type !== 'RBRACK') {
                    content.push(this.next().text);
                }
                const fullLabel = content.join(' ');
                attrs['label'] = fullLabel;
            }

            if (this.peek().type === 'RBRACK') this.next();
        }

        // --- Fields (ERD / Class Diagram) ---
        if (this.peek().type === 'LBRACE') {
            this.next();
            fields = [];
            while (!this.eof() && this.peek().type !== 'RBRACE') {
                if (this.peek().type === 'NEWLINE' || this.peek().type === 'OTHER') { this.next(); continue; }

                // PlantUML method/field parsing logic is complex,
                // but generic "name type" parser often works well enough for display
                if (this.peek().type === 'IDENT' || this.peek().type === 'DASH' || this.peek().type === 'ADD') {
                    // Simple capture of line as raw field
                    let rawParts: string[] = [];
                    while(!this.eof() && !['NEWLINE', 'RBRACE'].includes(this.peek().type)) {
                        rawParts.push(this.next().text);
                    }
                    fields.push({ name: rawParts.join(' '), raw: rawParts.join(' ') });
                    continue;
                }
                this.next();
            }
            if (this.peek().type === 'RBRACE') this.next();
        }

        if (this.peek().type === 'NEWLINE') this.next();

        return { kind: 'entity', id: id!, attrs, fields, raw: id };
    }

    collectUntil(endType: Token['type']): Token[] {
        const acc: Token[] = [];
        while (!this.eof() && this.peek().type !== endType) {
            acc.push(this.next());
        }
        return acc;
    }

    tokensToKeyValues(tokens: Token[]): Record<string, string> {
        const out: Record<string, string> = {};
        let i = 0;
        while (i < tokens.length) {
            while (i < tokens.length && (tokens[i].type === 'NEWLINE' || tokens[i].type === 'OTHER')) i++;
            if (i >= tokens.length) break;

            if (tokens[i].type !== 'IDENT') { i++; continue; }
            const key = tokens[i].text; i++;

            while (i < tokens.length && tokens[i].type !== 'COLON') i++;
            if (i < tokens.length && tokens[i].type === 'COLON') i++;

            const val: string[] = [];
            while (i < tokens.length && tokens[i].type !== 'COMMA') {
                val.push(tokens[i].text);
                i++;
            }
            if (i < tokens.length && tokens[i].type === 'COMMA') i++;

            out[key] = val.join(' ').trim();
        }
        return out;
    }

    parseEdgeLine(): EdgeNode[] {
        const lineTokens: Token[] = [];
        // Capture tokens until newline
        while (!this.eof() && this.peek().type !== 'NEWLINE') {
            lineTokens.push(this.next());
        }
        if (this.peek().type === 'NEWLINE') this.next();

        const parts: Array<{ kind: 'node' | 'connector' | 'colon' | 'label' | 'other'; text: string }> = [];
        let i = 0;

        while (i < lineTokens.length) {
            const t = lineTokens[i];

            // Mermaid Label on edge: -->|text|
            if (this.dslMode === 'mermaid' && t.type === 'PIPE') {
                i++;
                const labelParts: string[] = [];
                while(i < lineTokens.length && lineTokens[i].type !== 'PIPE') {
                    labelParts.push(lineTokens[i].text);
                    i++;
                }
                if(i < lineTokens.length) i++; // consume closing pipe
                parts.push({ kind: 'label', text: labelParts.join(' ') });
                continue;
            }

            // Standard parsing
            if (t.type === 'LBRACK') {
                // Skip attributes/inline arrays in edge definitions for now to avoid breaking connectivity
                let depth = 1; i++;
                while (i < lineTokens.length && depth > 0) {
                    if (lineTokens[i].type === 'LBRACK') depth++;
                    if (lineTokens[i].type === 'RBRACK') depth--;
                    i++;
                }
                continue;
            }

            if (t.type === 'IDENT') parts.push({ kind: 'node', text: t.text });
            else if (t.type === 'GT_LT') parts.push({ kind: 'connector', text: '<>' });
            else if (t.type === 'GT') parts.push({ kind: 'connector', text: '>' });
            else if (t.type === 'ARROW') parts.push({ kind: 'connector', text: t.text });
            else if (t.type === 'DASH') parts.push({ kind: 'connector', text: '-' });
            else if (t.type === 'COLON') parts.push({ kind: 'colon', text: ':' });
            else parts.push({ kind: 'other', text: t.text });

            i++;
        }

        let label: string | undefined;
        // Check for Eraser style colon label
        const colonIdx = parts.findIndex(p => p.kind === 'colon');
        // Check for Mermaid style pipe label
        const pipeLabel = parts.find(p => p.kind === 'label');

        if (colonIdx >= 0) {
            label = parts.slice(colonIdx + 1).map(p => p.text).join(' ').trim();
        } else if (pipeLabel) {
            label = pipeLabel.text;
        }

        const chainParts = colonIdx >= 0 ? parts.slice(0, colonIdx) : parts;
        const chain: Array<{ nodes: string[] } | { connector: string }> = [];

        // Reconstruct chain (A) -> (B)
        i = 0;
        while (i < chainParts.length) {
            const p = chainParts[i];
            if (p.kind === 'node') {
                chain.push({ nodes: [p.text] }); // Simplified: handle commas if needed
                i++;
            } else if (p.kind === 'connector') {
                chain.push({ connector: p.text });
                i++;
            } else {
                i++;
            }
        }

        const edges: EdgeNode[] = [];
        let lastNodes: string[] | null = null;
        i = 0;
        while (i < chain.length) {
            const el = chain[i];
            if ('nodes' in el) {
                lastNodes = el.nodes;
                i++;
                continue;
            }
            if ('connector' in el && lastNodes) {
                const next = chain[i + 1];
                if (!next || !('nodes' in next)) { i++; continue; }

                // Determine kind
                let kind: EdgeNode['kind'] = 'directed';
                if (el.connector === '<>') kind = 'bidirectional';
                else if (el.connector === '-') kind = 'undirected';
                else if (el.connector === '-->') kind = 'directed'; // Generic arrow

                for (const from of lastNodes) {
                    for (const to of next.nodes) {
                        edges.push({
                            from,
                            to,
                            kind,
                            label,
                            raw: `${from} ${el.connector} ${to}`
                        });
                    }
                }
                lastNodes = next.nodes;
                i += 2;
            } else {
                i++;
            }
        }

        return edges;
    }
}

export function parseEraserDSL(input: string): DiagramAST {
    const toks = tokenize(input);
    const p = new Parser(toks);
    return p.parse();
}