const { parseEraserDSL } = require('./parser');

// Test 1: Lone identifier
console.log('\n=== Test 1: Lone identifier ===');
try {
    const input = 'Customer\nAnotherNode';
    const ast = parseEraserDSL(input);
    console.log('Root blocks:', ast.rootBlocks.length);
    console.log('Blocks:', ast.rootBlocks.map(b => b.id || b.name));
} catch (e) {
    console.error('ERROR:', e.message);
}

// Test 2: Inline attributes in edges
console.log('\n=== Test 2: Inline attributes in edges ===');
try {
    const input = 'Frontend [color: blue] -> Backend [color: red]';
    const ast = parseEraserDSL(input);
    console.log('Edges:', ast.edges.length);
    console.log('Root blocks:', ast.rootBlocks.length);
    if (ast.edges.length > 0) {
        console.log('Edge:', ast.edges[0].from, '->', ast.edges[0].to);
    }
    if (ast.rootBlocks.length > 0) {
        console.log('Nodes:', ast.rootBlocks.map(b => ({ id: b.id, attrs: b.attrs })));
    }
} catch (e) {
    console.error('ERROR:', e.message);
}

// Test 3: ER entity parsing
console.log('\n=== Test 3: ER entity parsing ===');
try {
    const input = `User {
  id integer pk
  email string nullable unique
  created_at date
}`;
    const ast = parseEraserDSL(input);
    console.log('Root blocks:', ast.rootBlocks.length);
    if (ast.rootBlocks[0]) {
        const node = ast.rootBlocks[0];
        console.log('Node ID:', node.id);
        console.log('Fields:', node.fields?.length);
        if (node.fields) {
            node.fields.forEach(f => console.log('  -', f.name, f.type, f.constraints));
        }
    }
} catch (e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
}
