// Unified recursive-descent parser for Eraser-style DSL -> AST
// Usable in Angular/Node. No external deps.

/////////////////////////////////////////
// AST Types
/////////////////////////////////////////

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
    // For ER-like nodes that include fields inside { ... }
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

/////////////////////////////////////////
// Tokenizer
/////////////////////////////////////////

type TokenType =
    | 'IDENT' | 'NUMBER' | 'STRING'
    | 'LBRACE' | 'RBRACE' | 'LBRACK' | 'RBRACK' | 'COLON' | 'COMMA'
    | 'GT' | 'LT' | 'GT_LT' | 'ARROW' | 'DASH' | 'NEWLINE' | 'EOF'
    | 'OTHER';

interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}

function isAlphaNumUnderscore(ch: string) {
    // Includes dash and dot for identifiers like "api-gateway" or "schema.table"
    return /[A-Za-z0-9_\-\.]/.test(ch);
}

function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    const len = input.length;
    let i = 0;
    let line = 1;
    let col = 1;

    const push = (type: TokenType, text: string) => tokens.push({ type, text, line, col });

    while (i < len) {
        const ch = input[i];

        // handle newlines
        if (ch === '\n') {
            push('NEWLINE', '\n');
            i++; line++; col = 1;
            continue;
        }

        // whitespace
        if (/\s/.test(ch)) {
            i++; col++;
            continue;
        }

        // comment line starting with //
        if (ch === '/' && input[i + 1] === '/') {
            let j = i;
            while (j < len && input[j] !== '\n') j++;
            const txt = input.slice(i, j);
            push('OTHER', txt);
            i = j;
            continue;
        }

        // 1. Check Arrows specifically (Must be before IDENT/AlphaNum checks because they start with - or <)
        if (ch === '-') {
            if (input[i+1] === '-' && input[i+2] === '>') {
                push('ARROW', '-->'); i += 3; col += 3; continue;
            }
            if (input[i+1] === '>') {
                push('ARROW', '->'); i += 2; col += 2; continue;
            }
            // Note: Single dash is NOT handled here.
            // It falls through to isAlphaNumUnderscore to allow "kebab-case-identifiers"
        }

        if (ch === '<') {
            if (input[i+1] === '>' ) { push('GT_LT', '<>'); i += 2; col += 2; continue; }
            push('LT', '<'); i++; col++; continue;
        }
        if (ch === '>') { push('GT', '>'); i++; col++; continue; }

        // 2. Strings
        if (ch === '"' || ch === "'") {
            const quote = ch;
            let j = i + 1;
            let escaped = false;
            let acc = '';
            while (j < len) {
                const c = input[j];
                if (c === '\\' && !escaped) { escaped = true; j++; continue; }
                if (c === quote && !escaped) { break; }
                acc += c;
                escaped = false;
                j++;
            }
            const hasClose = input[j] === quote;
            push('STRING', acc);
            j += hasClose ? 1 : 0;
            const consumed = j - i;
            i = j; col += consumed;
            continue;
        }

        // 3. Identifiers / Numbers (includes single dashes inside)
        if (isAlphaNumUnderscore(ch)) {
            let j = i;
            let acc = '';
            while (j < len && isAlphaNumUnderscore(input[j])) {
                acc += input[j];
                j++;
            }
            push('IDENT', acc);
            const consumed = j - i;
            i = j; col += consumed;
            continue;
        }

        // 4. Punctuation
        if (ch === '{') { push('LBRACE', '{'); i++; col++; continue; }
        if (ch === '}') { push('RBRACE', '}'); i++; col++; continue; }
        if (ch === '[') { push('LBRACK', '['); i++; col++; continue; }
        if (ch === ']') { push('RBRACK', ']'); i++; col++; continue; }
        if (ch === ':') { push('COLON', ':'); i++; col++; continue; }
        if (ch === ',') { push('COMMA', ','); i++; col++; continue; }

        // Fallback for single dash not part of ident (e.g. " - " spacing)
        if (ch === '-') { push('DASH', '-'); i++; col++; continue; }

        // anything else
        push('OTHER', ch);
        i++; col++;
    }

    push('EOF', '<EOF>');
    return tokens;
}

/////////////////////////////////////////
// Parser (recursive-descent)
/////////////////////////////////////////

class Parser {
    tokens: Token[];
    pos: number;
    diagramType: DiagramType = 'unknown';

    constructor(tokens: Token[], diagHint?: DiagramType) {
        this.tokens = tokens;
        this.pos = 0;
        if (diagHint) this.diagramType = diagHint;
    }

    // FIXED: Safety check for empty token array
    peek(n = 0): Token {
        if (this.tokens.length === 0) return { type: 'EOF', text: '', line: 0, col: 0 };
        return this.tokens[this.pos + n] ?? this.tokens[this.tokens.length - 1];
    }

    next(): Token {
        const t = this.peek();
        if (t.type !== 'EOF') this.pos++;
        return t;
    }

    expect(type: TokenType, consume = true): Token | null {
        const t = this.peek();
        if (t.type === type) {
            if (consume) this.next();
            return t;
        }
        return null;
    }

    consumeIf(type: TokenType): Token | null {
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

                // Group start: Name {
                if (next1 && next1.type === 'LBRACE') {
                    // Check if this is a Group OR an Entity with fields.
                    // Heuristic: If it looks like an Entity (fields inside), parse as Entity.
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

                // Metadata or Edge
                const isEdgeLine = this.looksLikeEdgeLine();
                if (isEdgeLine) {
                    const parsedEdges = this.parseEdgeLine();
                    edges.push(...parsedEdges);
                    continue;
                }

                // Metadata
                const metaPair = this.parseMetadataLine();
                if (metaPair) {
                    metadata[metaPair.key] = metaPair.value;
                    continue;
                }

                // Lone identifier
                const loneIdent = this.next();
                while (!this.eof() && this.peek().type !== 'NEWLINE') this.next();
                rootBlocks.push({
                    kind: 'entity',
                    id: loneIdent.text,
                    attrs: {},
                    raw: loneIdent.text,
                } as EntityNode);
                continue;
            }

            if (t.type === 'EOF') break;

            // Edges starting without ident (rare but possible with weird formatting)
            if (this.looksLikeEdgeLine()) {
                const parsed = this.parseEdgeLine();
                edges.push(...parsed);
                continue;
            }

            this.next();
        }

        return {
            diagramType: this.diagramType,
            metadata,
            rootBlocks,
            edges,
            rawLineCount: lineCount,
        };
    }

    // Heuristic: Peek inside "Ident { ... }" to see if it contains "field type" patterns
    looksLikeEntityDef(): boolean {
        // We are at IDENT, peek(1) is LBRACE. Look at peek(2) onwards.
        let i = 2;
        // Skip newlines/comments inside the brace
        while(true) {
            const t = this.peek(i);
            if (t.type === 'EOF') return false;
            if (t.type === 'RBRACE') return false; // Empty block -> treat as Group or empty Entity (default to Group)
            if (t.type === 'NEWLINE' || t.type === 'OTHER') { i++; continue; }
            break;
        }

        const t1 = this.peek(i);
        const t2 = this.peek(i+1);

        // If we see: IDENT IDENT (name type), it's likely an Entity field
        if (t1.type === 'IDENT' && t2.type === 'IDENT') return true;
        // If we see: IDENT STRING (name "type"), possible
        if (t1.type === 'IDENT' && t2.type === 'STRING') return true;

        // If we see: IDENT [ (Node with attrs) or IDENT { (Nested group), it's a Group
        if (t1.type === 'IDENT' && (t2.type === 'LBRACK' || t2.type === 'LBRACE')) return false;

        // Default
        return false;
    }

    looksLikeEdgeLine(): boolean {
        let i = 0;
        while (true) {
            const t = this.peek(i);
            if (!t || t.type === 'EOF') return false;
            if (t.type === 'NEWLINE') break;
            if (t.type === 'GT' || t.type === 'GT_LT' || t.type === 'ARROW') return true;
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
            // Handle quoted strings explicitly to remove quotes if needed,
            // but here we keep raw text usually.
            pieces.push(t.text);
        }
        if (this.peek().type === 'NEWLINE') this.next();
        const value = pieces.join(' ').trim();
        if (value === '') return { key: keyTok.text, value: true };
        return { key: keyTok.text, value };
    }

    parseGroup(): GroupNode {
        const nameTok = this.expect('IDENT');
        const groupName = nameTok ? nameTok.text : 'group';
        this.expect('LBRACE');
        const children: BlockNode[] = [];

        while (!this.eof() && this.peek().type !== 'RBRACE') {
            if (this.peek().type === 'NEWLINE' || this.peek().type === 'OTHER') { this.next(); continue; }

            // FIXED: Distinguish nested Group from Entity
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
                    // Simple node: "NodeName"
                    const idTok = this.next();
                    while (!this.eof() && this.peek().type !== 'NEWLINE') this.next();
                    children.push({
                        kind: 'entity',
                        id: idTok.text,
                        attrs: {},
                        raw: idTok.text,
                    } as EntityNode);
                    continue;
                }
            }

            if (this.looksLikeEdgeLine()) {
                this.parseEdgeLine(); // Consume but discard in this version
                continue;
            }

            this.next();
        }

        if (this.peek().type === 'RBRACE') this.next();
        return { kind: 'group', name: groupName, children };
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
                    if (constraintText.length > 0) {
                        constraints.push(...constraintText.split(/\s+/));
                    }

                    if (this.peek().type === 'NEWLINE') this.next();

                    fields.push({
                        name: nameTok.text,
                        type: typeTok ? typeTok.text : undefined,
                        constraints,
                        raw: `${nameTok.text} ${typeTok ? typeTok.text : ''} ${constraintText}`.trim(),
                    });
                    continue;
                }
                this.next();
            }
            if (this.peek().type === 'RBRACE') this.next();
        }

        if (this.peek().type === 'NEWLINE') this.next();

        return {
            kind: 'entity',
            id,
            attrs,
            fields,
            raw: id,
        };
    }

    collectUntil(endType: TokenType): Token[] {
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

            // FIXED: Ensure we have a key IDENT
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

        // FIXED: Handle attributes in edge definitions (e.g. A [color:red] > B)
        // We iterate manually to skip over bracketed content so they don't look like nodes
        let i = 0;
        while(i < lineTokens.length) {
            const t = lineTokens[i];
            if (t.type === 'LBRACK') {
                // Consume until RBRACK and ignore (or store as raw metadata later if improved)
                // For now: prevent attributes from becoming nodes in the edge chain
                i++;
                while(i < lineTokens.length && lineTokens[i].type !== 'RBRACK') i++;
                i++; // skip RBRACK
                continue;
            }

            if (t.type === 'IDENT') parts.push({ kind: 'node', text: t.text });
            else if (t.type === 'GT_LT') parts.push({ kind: 'connector', text: '<>' });
            else if (t.type === 'GT') parts.push({ kind: 'connector', text: '>' });
            else if (t.type === 'ARROW') parts.push({ kind: 'connector', text: t.text });
            else if (t.type === 'COLON') { parts.push({ kind: 'colon', text: ':' }); }
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
                let kind: EdgeKind = 'directed';
                if (connector === '<>' ) kind = 'bidirectional';
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
}

/////////////////////////////////////////
// Public parse function
/////////////////////////////////////////

export function parseEraserDSL(input: string, diagHint?: DiagramType): DiagramAST {
    const toks = tokenize(input);
    const p = new Parser(toks, diagHint);
    return p.parse();
}