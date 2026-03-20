export function calculateTechDebt(nodes, links) {
  // 1. Calculate In-degree and Out-degree
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    if (sourceNode) sourceNode.outDegree++;
    if (targetNode) targetNode.inDegree++;
  });

  // 2. Identify Architectural Anti-Patterns & Behavioral Analysis
  nodes.forEach(n => {
    // Pain Score: Complexity (Lines) * Churn (Risk)
    // 0 to ~10,000+
    n.painScore = (n.val || 10) * (n.churnScore || 0);

    n.issues = []; // List of specific, actionable strings

    // God Object: Has too many outbound dependencies or is extremely long
    if (n.outDegree > 15 || n.val > 300) {
      n.isGodObject = true;
      n.issues.push(`Massive Entity: ${n.val} lines and ${n.outDegree} external calls. Action: Extract classes or apply Single Responsibility Principle.`);
    }
    
    // High Pain Score
    if (n.painScore > 5000) {
        n.issues.push(`Volatility Danger: Highly complex logic modified frequently (${n.churnScore}% churn). Action: Write unit tests to lock down behavior, then simplify.`);
    }

    // Dead Code: No incoming links, and not a standard entry point
    const entryPoints = ['Start', 'Update', 'Awake', 'main', 'OnEnable', 'OnDisable'];
    if (n.inDegree === 0 && !entryPoints.includes(n.name) && n.name !== 'Global') {
      n.isDeadCode = true;
      n.issues.push("Unreachable Code: 0 incoming calls. Action: Safe to delete to reduce build size.");
    }
  });

  return nodes;
}
