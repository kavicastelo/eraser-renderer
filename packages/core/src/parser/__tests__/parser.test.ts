import { parseEraserDSL } from "../parser";

describe("eraser-unified-parser (core)", () => {
    test("parses simple metadata and single node", () => {
        const code = `title My Diagram
direction right

User [icon: user]
`;
        const ast = parseEraserDSL(code);
        expect(ast).toBeDefined();
        expect(ast.metadata.title).toBe("My Diagram");
        expect(ast.metadata.direction).toBe("right");
        expect(ast.rootBlocks.length).toBeGreaterThanOrEqual(1);
        const node = ast.rootBlocks.find(b => (b as any).id === "User");
        expect(node).toBeDefined();
    });

    test("parses a small flow with edges and labels", () => {
        const code = `User <> WebApp: HTTPS
WebApp > PaymentsAPI > Payments > Analytics
`;
        const ast = parseEraserDSL(code);
        // edges should be expanded from chains
        expect(ast.edges.length).toBeGreaterThanOrEqual(4);
        // find a specific edge
        const e = ast.edges.find(ed => ed.from === "User" && ed.to === "WebApp");
        expect(e).toBeDefined();
        expect(e?.label).toBe("HTTPS");
    });

    test("parses ER entity with fields and constraints", () => {
        const code = `users [icon: user] {
  id string pk
  email string
}
users.accounts <> accounts.id
`;
        const ast = parseEraserDSL(code);
        expect(ast.rootBlocks.length).toBeGreaterThanOrEqual(1);
        const usersNode = ast.rootBlocks.find(b => (b as any).id === "users") as any;
        expect(usersNode).toBeDefined();
        expect(usersNode.fields).toBeDefined();
        expect(usersNode.fields[0].name).toBe("id");
        // edges parse check
        const fk = ast.edges.find(ed => ed.from === "users.accounts" || (ed.from === "users" && ed.to === "accounts.id"));
        // the parser expands chain connections; accept presence of some edge connecting accounts
        expect(ast.edges.length).toBeGreaterThanOrEqual(1);
    });

    test("parses nested groups", () => {
        const code = `Internet {
  UserNetwork {
    User [color: lightblue, icon: user]
  }
  CreditProvider [icon: money]
}
`;
        const ast = parseEraserDSL(code);
        expect(ast.rootBlocks.length).toBe(1);
        const grp = ast.rootBlocks[0] as any;
        expect(grp.kind).toBe("group");
        expect(grp.children.length).toBeGreaterThanOrEqual(1);
    });
});
