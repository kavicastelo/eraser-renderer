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

type _TokenType = Token['type'];

class Parser {
    tokens: Token[];
    pos: number;
    diagramType: DiagramType = 'unknown';

    constructor(tokens: Token[], diagHint?: DiagramType) {
        this.tokens = tokens;
        this.pos = 0;
        if (diagHint) this.diagramType = diagHint;
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

        while (!this.eof()) {
            const t = this.peek();
            if (t.type === 'NEWLINE' || t.type === 'OTHER') { this.next(); continue; }

            if (t.type === 'IDENT') {
                const next1 = this.peek(1);
                const next2 = this.peek(2);

                // "group NAME {"
                if (t.text.toLowerCase() === 'group' && next1?.type === 'IDENT' && next2?.type === 'LBRACE') {
                    this.next(); // 'group'
                    const nameTok = this.expect('IDENT');
                    const group = this.parseGroup(nameTok?.text);
                    rootBlocks.push(group);
                    continue;
                }

                // Name {
                if (next1?.type === 'LBRACE') {
                    if (this.looksLikeEntityDef()) {
                        rootBlocks.push(this.parseEntityOrNode());
                    } else {
                        rootBlocks.push(this.parseGroup());
                    }
                    continue;
                }

                // id [...]
                if (next1?.type === 'LBRACK') {
                    rootBlocks.push(this.parseEntityOrNode());
                    continue;
                }

                // Edge or metadata
                if (this.looksLikeEdgeLine()) {
                    edges.push(...this.parseEdgeLine());
                    continue;
                }

                // Metadata: key value
                const meta = this.parseMetadataLine();
                if (meta) {
                    metadata[meta.key] = meta.value;
                    continue;
                }

                // Lone identifier
                const idTok = this.next();
                rootBlocks.push({
                    kind: 'entity',
                    id: idTok.text,
                    attrs: {},
                    raw: idTok.text
                } as EntityNode);
                while (!this.eof() && this.peek().type !== 'NEWLINE') this.next();
                continue;
            }

            if (this.looksLikeEdgeLine()) {
                edges.push(...this.parseEdgeLine());
                continue;
            }

            this.next();
        }

        // Always infer diagram type from the actual parsed structure
        this.diagramType = this.inferDiagramType(rootBlocks, edges, metadata);

        return {
            diagramType: this.diagramType,
            metadata,
            rootBlocks,
            edges,
            rawLineCount: lineCount
        };
    }

    // Robust, AST-based diagram type detection
    private inferDiagramType(
        rootBlocks: BlockNode[],
        edges: EdgeNode[],
        metadata: Record<string, string | boolean>
    ): DiagramType {
        // 1. Explicit metadata wins
        if (metadata['type'] && typeof metadata['type'] === 'string') {
            return metadata['type'] as DiagramType;
        }

        let hasFields = false;                    // ER / Class
        let hasDirectedEdges = false;
        let hasActorStyleAttrs = false;           // [icon:], [color:], [label:]
        let hasAutoNumber = false;
        let hasSequenceKeywordInLabel = false;
        let hasParticipantLikeNode = false;

        // Check metadata
        if (metadata['autoNumber'] !== undefined) hasAutoNumber = true;
        if (metadata['title'] || metadata['colorMode'] || metadata['styleMode']) hasActorStyleAttrs = true;

        // Scan edges
        for (const e of edges) {
            if (e.kind === 'directed' || e.kind === 'bidirectional') hasDirectedEdges = true;
            if (e.label) {
                const l = e.label.toLowerCase();
                if (/activate|deactivate|note|alt|loop|over|return|destroy|ref/i.test(l)) {
                    hasSequenceKeywordInLabel = true;
                }
            }
        }

        // Scan all blocks
        const visit = (node: BlockNode) => {
            if (node.kind === 'entity') {
                if (node.fields && node.fields.length > 0) {
                    hasFields = true;
                }
                if (node.attrs) {
                    const keys = Object.keys(node.attrs).map(k => k.toLowerCase());
                    if (keys.some(k => k === 'icon' || k === 'color' || k === 'label' || k === 'shape')) {
                        hasActorStyleAttrs = true;
                    }
                    if (node.attrs['participant'] || node.attrs['actor']) {
                        hasParticipantLikeNode = true;
                    }
                }

                // Node name hints
                const id = node.id.toLowerCase();
                if (['participant', 'actor', 'user', 'client', 'server', 'database'].includes(id)) {
                    hasParticipantLikeNode = true;
                }
            }

            if (node.kind === 'group') {
                const name = node.name.toLowerCase();
                if (['participant', 'actor', 'boundary', 'control', 'entity', 'database'].includes(name)) {
                    hasParticipantLikeNode = true;
                }
                node.children.forEach(visit);
            }
        };

        rootBlocks.forEach(visit);

        // Decision tree — highest confidence first
        if (hasAutoNumber || hasSequenceKeywordInLabel || hasParticipantLikeNode) {
            return 'sequence';
        }

        if (hasActorStyleAttrs && hasDirectedEdges && edges.length >= 3) {
            return 'sequence';   // Very strong Mermaid-style signal
        }

        if (hasFields) {
            return 'er';
        }

        if (edges.length > 0) {
            return 'graph';
        }

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
            if ([ 'GT', 'GT_LT', 'ARROW', 'DASH' ].includes(t.type)) return true;
            i++;
        }
    }

    parseMetadataLine(): { key: string; value: string | boolean } | null {
        const keyTok = this.consumeIf('IDENT');
        if (!keyTok) return null;
        const pieces: string[] = [];
        while (!this.eof() && this.peek().type !== 'NEWLINE') {
            pieces.push(this.next().text);
        }
        if (this.peek().type === 'NEWLINE') this.next();
        const value = pieces.join(' ').trim();
        return { key: keyTok.text, value: value === '' ? true : value };
    }

    parseGroup(explicitName?: string): GroupNode {
        let name = explicitName;
        if (!name) {
            const tok = this.expect('IDENT');
            name = tok ? tok.text : 'group';
        }
        this.consumeIf('LBRACE');

        const children: BlockNode[] = [];
        while (!this.eof() && this.peek().type !== 'RBRACE') {
            if (this.peek().type === 'NEWLINE' || this.peek().type === 'OTHER') { this.next(); continue; }

            if (this.peek().type === 'IDENT' && this.peek(1).type === 'LBRACE') {
                children.push(this.looksLikeEntityDef() ? this.parseEntityOrNode() : this.parseGroup());
                continue;
            }
            if (this.peek().type === 'IDENT' && this.peek(1).type === 'LBRACK') {
                children.push(this.parseEntityOrNode());
                continue;
            }
            if (this.peek().type === 'IDENT') {
                const idTok = this.next();
                while (!this.eof() && this.peek().type !== 'NEWLINE') this.next();
                children.push({ kind: 'entity', id: idTok.text, attrs: {}, raw: idTok.text } as EntityNode);
                continue;
            }
            if (this.looksLikeEdgeLine()) {
                this.parseEdgeLine(); // discard internal edges for now
                continue;
            }
            this.next();
        }
        if (this.peek().type === 'RBRACE') this.next();
        return { kind: 'group', name: name!, children };
    }

    parseEntityOrNode(): EntityNode {
        const idTok = this.expect('IDENT');
        const id = idTok ? idTok.text : 'node';
        const attrs: Record<string, string> = {};
        let fields: FieldDef[] | undefined;

        if (this.peek().type === 'LBRACK') {
            this.next();
            const pairs = this.collectUntil('RBRACK');
            Object.assign(attrs, this.tokensToKeyValues(pairs));
            if (this.peek().type === 'RBRACK') this.next();
        }

        if (this.peek().type === 'LBRACE') {
            this.next();
            fields = [];
            while (!this.eof() && this.peek().type !== 'RBRACE') {
                if (this.peek().type === 'NEWLINE' || this.peek().type === 'OTHER') { this.next(); continue; }

                if (this.peek().type === 'IDENT') {
                    const nameTok = this.next();
                    let typeTok: Token | null = null;
                    const constraints: string[] = [];

                    if (this.peek().type === 'IDENT') typeTok = this.next();

                    const rest: string[] = [];
                    while (!this.eof() && ![ 'NEWLINE', 'RBRACE' ].includes(this.peek().type)) {
                        const t = this.next();
                        if (t.type !== 'COMMA') rest.push(t.text);
                    }

                    const constraintText = rest.join(' ').trim();
                    if (constraintText) constraints.push(...constraintText.split(/\s+/));

                    if (this.peek().type === 'NEWLINE') this.next();

                    fields.push({
                        name: nameTok.text,
                        type: typeTok?.text,
                        constraints,
                        raw: `${nameTok.text} ${typeTok?.text ?? ''} ${constraintText}`.trim()
                    });
                    continue;
                }
                this.next();
            }
            if (this.peek().type === 'RBRACE') this.next();
        }

        if (this.peek().type === 'NEWLINE') this.next();

        return { kind: 'entity', id, attrs, fields, raw: id };
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
        while (!this.eof() && this.peek().type !== 'NEWLINE') {
            lineTokens.push(this.next());
        }
        if (this.peek().type === 'NEWLINE') this.next();

        const parts: Array<{ kind: 'node' | 'connector' | 'colon' | 'other'; text: string }> = [];
        let i = 0;
        while (i < lineTokens.length) {
            const t = lineTokens[i];
            if (t.type === 'LBRACK') {
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
        const colonIdx = parts.findIndex(p => p.kind === 'colon');
        const chainParts = colonIdx >= 0 ? parts.slice(0, colonIdx) : parts;
        if (colonIdx >= 0) {
            label = parts.slice(colonIdx + 1).map(p => p.text).join(' ').trim() || undefined;
        }

        const chain: Array<{ nodes: string[] } | { connector: string }> = [];
        i = 0;
        while (i < chainParts.length) {
            const p = chainParts[i];
            if (p.kind === 'node') {
                const nodes = [p.text]; i++;
                while (i < chainParts.length && chainParts[i].text === ',') {
                    i++;
                    if (i < chainParts.length && chainParts[i].kind === 'node') {
                        nodes.push(chainParts[i].text);
                        i++;
                    }
                }
                chain.push({ nodes });
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
                const kind = el.connector === '<>' ? 'bidirectional' : el.connector === '-' ? 'undirected' : 'directed';
                for (const from of lastNodes) {
                    for (const to of next.nodes) {
                        edges.push({
                            from,
                            to,
                            kind,
                            label,
                            raw: `${from} ${el.connector} ${to}` + (label ? ` : ${label}` : '')
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

export function parseEraserDSL(input: string, diagHint?: DiagramType): DiagramAST {
    const toks = tokenize(input);
    const p = new Parser(toks, diagHint);
    return p.parse();
}