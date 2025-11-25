import { computeDiagramLayout } from "../layout-engine";
import { DiagramAST } from "@eraser/core";

describe("computeDiagramLayout", () => {

    it("should produce valid layout with nodes, groups, and edges", () => {

        const ast: DiagramAST = {
            diagramType: "flow",
            metadata: {},
            rawLineCount: 3,
            rootBlocks: [
                {
                    kind: "entity",
                    id: "A",
                    attrs: { label: "Node A" }
                },
                {
                    kind: "entity",
                    id: "B",
                    attrs: { label: "Node B" }
                },
                {
                    kind: "group",
                    name: "Group1",
                    children: [
                        { kind: "entity", id: "A", attrs: {} },
                        { kind: "entity", id: "B", attrs: {} }
                    ]
                }
            ],
            edges: [
                { from: "A", to: "B", kind: "directed" }
            ]
        };

        const layout = computeDiagramLayout(ast);

        expect(Object.keys(layout.nodes)).toHaveLength(2);
        expect(Object.keys(layout.groups)).toHaveLength(1);
        expect(layout.edges).toHaveLength(1);

        expect(layout.nodes["A"].bounds.width).toBeGreaterThan(0);
        expect(layout.groups["Group1"].bounds.width).toBeGreaterThan(0);
    });
});
