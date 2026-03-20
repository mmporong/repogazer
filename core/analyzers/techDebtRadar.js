/**
 * ARCHITECTURAL DIAGNOSTIC ENGINE (v8.0)
 * Focuses on purely deterministic technical debt without AI.
 */

export function calculateTechDebt(nodes, links) {
  // 1. Calculate In-degree and Out-degree
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    if (sourceNode) sourceNode.outDegree++;
    if (targetNode) targetNode.inDegree++;
  });

  // 2. CIRCULAR DEPENDENCY DETECTION (Tarjan's or simple DFS)
  // Finds nodes that participate in a cycle (A -> B -> A or A -> B -> C -> A)
  const visited = new Set();
  const recStack = new Set();
  const circularNodes = new Set();

  function findCycles(nodeId, path = []) {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const neighbors = links.filter(l => l.source === nodeId).map(l => l.target);
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        findCycles(neighbor, [...path]);
      } else if (recStack.has(neighbor)) {
        // Cycle found! Mark all nodes in the path from 'neighbor' onwards
        const cycleStartIndex = path.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          for (let i = cycleStartIndex; i < path.length; i++) {
            circularNodes.add(path[i]);
          }
        }
      }
    }
    recStack.delete(nodeId);
  }

  nodes.forEach(n => {
    if (!visited.has(n.id)) findCycles(n.id);
  });

  // 3. CODE CLONE DETECTION (Simplified via Snippet Hashing)
  // Identifies duplicate logic across different files
  const snippetMap = new Map();
  nodes.forEach(n => {
    if (n.snippet && n.snippet.length > 50) {
        // Normalize snippet: remove whitespace and comments for better matching
        const normalized = n.snippet.replace(/\s+/g, '').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
        if (!snippetMap.has(normalized)) {
            snippetMap.set(normalized, []);
        }
        snippetMap.get(normalized).push(n.id);
    }
  });

  // 4. Inject Diagnostic Data into Nodes
  nodes.forEach(n => {
    n.isCircular = circularNodes.has(n.id);
    n.cloneIds = [];
    
    // Find clones
    const normalized = n.snippet ? n.snippet.replace(/\s+/g, '').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '') : "";
    if (snippetMap.has(normalized) && snippetMap.get(normalized).length > 1) {
        n.cloneIds = snippetMap.get(normalized).filter(id => id !== n.id);
    }

    n.diagnostics = [];
    if (n.isCircular) n.diagnostics.push("🔴 CIRCULAR DEPENDENCY: This node is part of a call loop. Refactor to break the cycle.");
    if (n.cloneIds.length > 0) n.diagnostics.push(`🟣 CODE CLONE: ${n.cloneIds.length} other functions have identical implementation. Extract to shared utility.`);
    if (n.outDegree > 15) n.diagnostics.push("⚠️ GOD OBJECT: High outbound coupling. Violates Single Responsibility Principle.");
    if (n.inDegree === 0 && !['Start', 'Update', 'Awake'].includes(n.name)) n.isDeadCode = true;
    if (n.isDeadCode) n.diagnostics.push("💀 DEAD CODE: Unreachable from analyzed paths. Safe to delete.");
  });

  return nodes;
}
