import { parseEraserDSL as parseEraser } from "../eraser-unified-parser";

describe("Eraser Unified Parser", () => {
    test("parses a simple title directive", () => {
        const code = `title My Diagram`;
        const ast = parseEraser(code);

        expect(ast.metadata?.title).toBe("My Diagram");
    });

    test("parses a simple node declaration", () => {
        const code = `User [icon: user]`;
        const ast = parseEraser(code);

        // expect(ast.rootBlocks[0].type).toBe("node");
        // expect(ast.rootBlocks[0].id).toBe("User");
        expect(ast.rootBlocks[0].attrs?.icon).toBe("user");
    });
});
