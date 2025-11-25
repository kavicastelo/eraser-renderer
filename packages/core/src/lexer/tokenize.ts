import { Token, TokenType } from "./token-types";

function isAlphaNumUnderscore(ch: string) {
    return /[A-Za-z0-9_\-\.]/.test(ch);
}

export function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    const len = input.length;
    let i = 0;
    let line = 1;
    let col = 1;

    const push = (type: TokenType, text: string) => tokens.push({ type, text, line, col });

    while (i < len) {
        const ch = input[i];

        // newline
        if (ch === '\n') {
            push('NEWLINE', '\n'); i++; line++; col = 1; continue;
        }
        // whitespace
        if (/\s/.test(ch)) { i++; col++; continue; }

        // comment //
        if (ch === '/' && input[i+1] === '/') {
            let j = i;
            while (j < len && input[j] !== '\n') j++;
            const txt = input.slice(i, j);
            push('OTHER', txt);
            i = j; continue;
        }

        // arrows (must come before ident)
        if (ch === '-') {
            if (input[i+1] === '-' && input[i+2] === '>') { push('ARROW', '-->'); i += 3; col += 3; continue; }
            if (input[i+1] === '>') { push('ARROW', '->'); i += 2; col += 2; continue; }
        }

        if (ch === '<') {
            if (input[i+1] === '>') { push('GT_LT', '<>'); i += 2; col += 2; continue; }
            push('LT', '<'); i++; col++; continue;
        }
        if (ch === '>') { push('GT', '>'); i++; col++; continue; }

        // strings
        if (ch === '"' || ch === "'") {
            const quote = ch;
            let j = i + 1;
            let escaped = false;
            let acc = '';
            while (j < len) {
                const c = input[j];
                if (c === '\\' && !escaped) { escaped = true; j++; continue; }
                if (c === quote && !escaped) break;
                acc += c; escaped = false; j++;
            }
            const hasClose = input[j] === quote;
            push('STRING', acc);
            j += hasClose ? 1 : 0;
            const consumed = j - i;
            i = j; col += consumed;
            continue;
        }

        // ident / number (including dashes and dots)
        if (isAlphaNumUnderscore(ch)) {
            let j = i;
            let acc = '';
            while (j < len && isAlphaNumUnderscore(input[j])) { acc += input[j]; j++; }
            push('IDENT', acc);
            const consumed = j - i;
            i = j; col += consumed; continue;
        }

        // punctuation
        if (ch === '{') { push('LBRACE', '{'); i++; col++; continue; }
        if (ch === '}') { push('RBRACE', '}'); i++; col++; continue; }
        if (ch === '[') { push('LBRACK', '['); i++; col++; continue; }
        if (ch === ']') { push('RBRACK', ']'); i++; col++; continue; }
        if (ch === ':') { push('COLON', ':'); i++; col++; continue; }
        if (ch === ',') { push('COMMA', ','); i++; col++; continue; }

        if (ch === '-') { push('DASH', '-'); i++; col++; continue; }

        // fallback
        push('OTHER', ch);
        i++; col++;
    }

    push('EOF', '<EOF>');
    return tokens;
}
