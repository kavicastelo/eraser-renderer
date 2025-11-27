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
    TokenType
} from "../types-bridge";

// actually re-declare TokenType locally for runtime checks; TokenType used in earlier parser was a type alias
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

                // Special-case: "group NAME {"
                if (t.text.toLowerCase() === 'group' && next1 && next1.type === 'IDENT' && next2 && next2.type === 'LBRACE') {
                    // consume 'group' and the name, then parse group body
                    this.next(); // consume 'group'
                    const nameTok = this.expect('IDENT');
                    const group = this.parseGroup(nameTok ? nameTok.text : undefined);
                    rootBlocks.push(group);
                    continue;
                }

                // Group start: Name {   (e.g. "Deployments { ... }")
                if (next1 && next1.type === 'LBRACE') {
                    if (this.looksLikeEntityDef()) {
                        const node = this.parseEntityOrNode();
                        rootBlocks.push(node);
                    } else {
                        const group = this.parseGroup();
                        rootBlocks.push(group);
                    }
                    continue;
                }

                // Node with attrs: id [ ... ]
                if (next1 && next1.type === 'LBRACK') {
                    const node = this.parseEntityOrNode();
                    rootBlocks.push(node);
                    continue;
                }

                // Edge or metadata
                const isEdgeLine = this.looksLikeEdgeLine();
                if (isEdgeLine) {
                    const parsedEdges = this.parseEdgeLine();
                    edges.push(...parsedEdges);
                    continue;
                }

                // Metadata line
                const metaPair = this.parseMetadataLine();
                if (metaPair) {
                    metadata[metaPair.key] = metaPair.value;
                    continue;
                }

                // Lone identifier node
                const loneIdent = this.next();
                rootBlocks.push({
                    kind: 'entity',
                    id: loneIdent.text,
                    attrs: {},
                    raw: loneIdent.text
                } as EntityNode);
                // consume rest of line
                while (!this.eof() && this.peek().type !== 'NEWLINE') this.next();
                continue;
            }

            if (t.type === 'EOF') break;

            if (this.looksLikeEdgeLine()) {
                const parsed = this.parseEdgeLine();
                edges.push(...parsed);
                continue;
            }

            this.next();
        }

        if (this.diagramType === 'unknown') {
            this.diagramType = this.detectDiagramType(this.tokens);
        }

        return {
            diagramType: this.diagramType,
            metadata,
            rootBlocks,
            edges,
            rawLineCount: lineCount
        };
    }

    looksLikeEntityDef(): boolean {
        let i = 2;
        while(true) {
            const t = this.peek(i);
            if (t.type === 'EOF') return false;
            if (t.type === 'RBRACE') return false;
            if (t.type === 'NEWLINE' || t.type === 'OTHER') { i++; continue; }
            break;
        }

        const t1 = this.peek(i);
        const t2 = this.peek(i+1);
        if (t1.type === 'IDENT' && t2.type === 'IDENT') return true;
        if (t1.type === 'IDENT' && t2.type === 'STRING') return true;
        if (t1.type === 'IDENT' && (t2.type === 'LBRACK' || t2.type === 'LBRACE')) return false;
        return false;
    }

    looksLikeEdgeLine(): boolean {
        let i = 0;
        while (true) {
            const t = this.peek(i);
            if (!t || t.type === 'EOF') return false;
            if (t.type === 'NEWLINE') break;
            // Detect any connector tokens: >, <>, ->, --\>, or single dash
            if (t.type === 'GT' || t.type === 'GT_LT' || t.type === 'ARROW' || t.type === 'DASH') return true;
            i++;
        }
        return false;
    }

    parseMetadataLine(): { key: string; value: string | boolean } | null {
        const keyTok = this.consumeIf('IDENT');
        if (!keyTok) return null;
        const pieces: string[] = [];
        while (!this.eof() && this.peek().type !== 'NEWLINE') {
            const t = this.next();
            pieces.push(t.text);
        }
        if (this.peek().type === 'NEWLINE') this.next();
        const value = pieces.join(' ').trim();
        if (value === '') return { key: keyTok.text, value: true };
        return { key: keyTok.text, value };
    }

    parseGroup(explicitName?: string): GroupNode {
        // If explicitName provided, we've already consumed the name token.
        let groupName = explicitName;
        if (!groupName) {
            const nameTok = this.expect('IDENT');
            groupName = nameTok ? nameTok.text : 'group';
        }

        // Expect LBRACE (either current token is LBRACE or next)
        if (this.peek().type === 'LBRACE') {
            this.next();
        } else {
            this.expect('LBRACE'); // will return null if missing, but continue parsing defensively
        }

        const children: BlockNode[] = [];

        while (!this.eof() && this.peek().type !== 'RBRACE') {
            if (this.peek().type === 'NEWLINE' || this.peek().type === 'OTHER') { this.next(); continue; }

            // Nested group or entity-with-brace
            if (this.peek().type === 'IDENT' && this.peek(1).type === 'LBRACE') {
                if (this.looksLikeEntityDef()) {
                    children.push(this.parseEntityOrNode());
                } else {
                    children.push(this.parseGroup());
                }
                continue;
            }

            if (this.peek().type === 'IDENT') {
                const next = this.peek(1);
                if (next && next.type === 'LBRACK') {
                    children.push(this.parseEntityOrNode());
                    continue;
                } else {
                    const idTok = this.next();
                    while (!this.eof() && this.peek().type !== 'NEWLINE') this.next();
                    children.push({
                        kind: 'entity',
                        id: idTok.text,
                        attrs: {},
                        raw: idTok.text
                    } as EntityNode);
                    continue;
                }
            }

            if (this.looksLikeEdgeLine()) {
                // consume edges inside group — they may connect internal/external nodes
                const groupEdges = this.parseEdgeLine(); // currently we discard; could store
                // optional: store or process groupEdges if you want to attach edges to root
                children; // no-op
                continue;
            }

            this.next();
        }

        if (this.peek().type === 'RBRACE') this.next();
        return { kind: 'group', name: groupName!, children };
    }

    parseEntityOrNode(): EntityNode {
        const idTok = this.expect('IDENT');
        const id = idTok ? idTok.text : 'node';
        const attrs: Record<string, string> = {};
        let fields: FieldDef[] | undefined;

        if (this.peek().type === 'LBRACK') {
            this.next();
            const attrPairs = this.collectUntil('RBRACK');
            const kvs = this.tokensToKeyValues(attrPairs);
            Object.assign(attrs, kvs);
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

                    if (this.peek().type === 'IDENT') {
                        typeTok = this.next();
                    }

                    const remaining: string[] = [];
                    while (!this.eof() && this.peek().type !== 'NEWLINE' && this.peek().type !== 'RBRACE') {
                        const t = this.next();
                        if (t.type === 'IDENT' || t.type === 'STRING') remaining.push(t.text);
                        else if (t.type === 'COMMA') continue;
                        else remaining.push(t.text);
                    }

                    const constraintText = remaining.join(' ').trim();
                    if (constraintText.length > 0) { constraints.push(...constraintText.split(/\s+/)); }

                    if (this.peek().type === 'NEWLINE') this.next();

                    fields.push({
                        name: nameTok.text,
                        type: typeTok ? typeTok.text : undefined,
                        constraints,
                        raw: `${nameTok.text} ${typeTok ? typeTok.text : ''} ${constraintText}`.trim()
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
        const n = tokens.length;
        while (i < n) {
            while (i < n && (tokens[i].type === 'NEWLINE' || tokens[i].type === 'OTHER')) i++;
            if (i >= n) break;

            const k = tokens[i];
            if (k.type !== 'IDENT') { i++; continue; }

            const key = k.text;
            i++;
            while (i < n && tokens[i].type !== 'COLON') i++;
            if (i < n && tokens[i].type === 'COLON') i++;

            const valParts: string[] = [];
            while (i < n && tokens[i].type !== 'COMMA') {
                const t = tokens[i];
                if (t.type === 'STRING') valParts.push(t.text);
                else valParts.push(t.text);
                i++;
            }
            if (i < n && tokens[i].type === 'COMMA') i++;

            out[key] = valParts.join(' ').trim();
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
                // skip entire attribute block
                let depth = 1;
                i++;
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
            else if (t.type === 'COMMA') parts.push({ kind: 'other', text: ',' });
            else if (t.type === 'STRING') parts.push({ kind: 'other', text: `"${t.text}"` });
            else if (t.type === 'OTHER') parts.push({ kind: 'other', text: t.text });

            i++;
        }

        let label = undefined;
        const colonIndex = parts.findIndex(p => p.kind === 'colon');
        let tokenChainParts = parts;
        if (colonIndex >= 0) {
            const labelParts = parts.slice(colonIndex + 1).map(p => p.text);
            label = labelParts.join(' ').trim();
            tokenChainParts = parts.slice(0, colonIndex);
        }

        const chain: Array<{ nodes: string[] } | { connector: string }> = [];
        let idx = 0;
        while (idx < tokenChainParts.length) {
            const p = tokenChainParts[idx];
            if (p.kind === 'node') {
                const nodes = [p.text];
                idx++;
                while (idx < tokenChainParts.length && tokenChainParts[idx].text === ',') {
                    idx++;
                    if (idx < tokenChainParts.length && tokenChainParts[idx].kind === 'node') {
                        nodes.push(tokenChainParts[idx].text);
                        idx++;
                    }
                }
                chain.push({ nodes });
                continue;
            } else if (p.kind === 'connector') {
                chain.push({ connector: p.text });
                idx++;
                continue;
            } else {
                idx++;
            }
        }

        const edges: EdgeNode[] = [];
        let cIdx = 0;
        let lastNodes: string[] | null = null;
        while (cIdx < chain.length) {
            const el = chain[cIdx];
            if ('nodes' in el) {
                lastNodes = el.nodes;
                cIdx++;
                continue;
            }
            if ('connector' in el) {
                const connector = el.connector;
                const next = chain[cIdx + 1];
                if (!next || !('nodes' in next)) { cIdx += 1; continue; }
                const nextNodes = next.nodes;
                let kind: EdgeNode['kind'] = 'directed';
                if (connector === '<>') kind = 'bidirectional';
                else if (connector === '-') kind = 'undirected';
                else kind = 'directed';

                const froms = lastNodes ?? [];
                for (const f of froms) {
                    for (const t of nextNodes) {
                        edges.push({
                            from: f,
                            to: t,
                            kind,
                            label,
                            raw: `${f} ${connector} ${t}` + (label ? ` : ${label}` : ''),
                        });
                    }
                }
                cIdx += 2;
                lastNodes = nextNodes;
                continue;
            }
            cIdx++;
        }

        return edges;
    }

    private detectDiagramType(tokens: Token[]): DiagramType {
        let sawArrow = false;
        let sawBidirectional = false;
        let sawEntityFields = false;
        let sawClassKeyword = false;
        let sawSequenceKeywords = false;

        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];

            // Graph-style arrows
            if (t.type === 'ARROW' || t.type === 'GT') sawArrow = true;
            if (t.type === 'GT_LT') sawBidirectional = true;
            if (t.type === 'DASH') sawArrow = true;

            // ER: detect IDENT IDENT inside { }
            if (t.type === 'IDENT' && tokens[i + 1]?.type === 'IDENT') {
                const next = tokens[i + 2];
                if (next?.type === 'RBRACE' || next?.type === 'STRING') {
                    sawEntityFields = true;
                }
            }

            // Class diagrams
            if (t.type === 'IDENT' && t.text.toLowerCase() === 'class') {
                sawClassKeyword = true;
            }

            // Sequence diagrams
            if (
                t.type === 'IDENT' &&
                ['participant', 'activate', 'deactivate', 'note', 'alt', 'loop'].includes(
                    t.text.toLowerCase()
                )
            ) {
                sawSequenceKeywords = true;
            }
        }

        // --- Classification ---
        if (sawSequenceKeywords) return 'sequence';
        if (sawClassKeyword) return 'class';
        if (sawEntityFields) return 'er';
        if (sawBidirectional) return 'graph';
        if (sawArrow) return 'graph';

        return 'unknown';
    }
}

export function parseEraserDSL(input: string, diagHint?: DiagramType): DiagramAST {
    const toks = tokenize(input);
    const p = new Parser(toks, diagHint);
    return p.parse();
}
