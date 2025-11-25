export type TokenType =
    | 'IDENT' | 'NUMBER' | 'STRING'
    | 'LBRACE' | 'RBRACE' | 'LBRACK' | 'RBRACK' | 'COLON' | 'COMMA'
    | 'GT' | 'LT' | 'GT_LT' | 'ARROW' | 'DASH' | 'NEWLINE' | 'EOF'
    | 'OTHER';

export interface Token {
    type: TokenType;
    text: string;
    line: number;
    col: number;
}
