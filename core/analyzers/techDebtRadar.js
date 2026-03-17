export function calculateTechDebt(nodes, links) {
  // 1. Calculate In-degree and Out-degree
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    if (sourceNode) sourceNode.outDegree++;
    if (targetNode) targetNode.inDegree++;
  });

  // 2. Identify Architectural Anti-Patterns
  nodes.forEach(n => {
    // God Object: Has too many outbound dependencies or is extremely long
    if (n.outDegree > 15 || n.val > 300) {
      n.isGodObject = true;
    }
    
    // Dead Code: No incoming links, and not a standard entry point
    const entryPoints = ['Start', 'Update', 'Awake', 'main', 'OnEnable', 'OnDisable'];
    if (n.inDegree === 0 && !entryPoints.includes(n.name) && n.name !== 'Global') {
      n.isDeadCode = true;
    }
  });

  return nodes;
}
