import { Token } from "../lexer/token-types";

export class ParserState {
    private index = 0;
    constructor(public tokens: Token[]) {}

    peek(offset = 0) {
        return this.tokens[this.index + offset];
    }

    next() {
        return this.tokens[this.index++];
    }

    match(type: string) {
        const t = this.peek();
        if (t && t.type === type) {
            this.next();
            return t;
        }
        return null;
    }

    expect(type: string): Token {
        const t = this.next();
        if (!t || t.type !== type) {
            throw new Error(
                `Expected token ${type}, got ${t?.type}`
            );
        }
        return t;
    }

    eof() {
        return this.index >= this.tokens.length;
    }
}
