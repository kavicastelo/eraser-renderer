import { parseEraserDSL } from "../parser";

test("smoke parse small DSL", () => {
    const code = `title Hello
direction right
A [icon: user]
A > B: label
`;
    const ast = parseEraserDSL(code);
    expect(ast).toBeDefined();
    expect(ast.metadata.title).toBe("Hello");
    expect(ast.rootBlocks.some(b => (b as any).id === "A")).toBeTruthy();
    expect(ast.edges.length).toBeGreaterThan(0);
});
