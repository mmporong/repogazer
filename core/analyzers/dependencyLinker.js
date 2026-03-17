import fs from 'fs';
import path from 'path';

export function mapDependencies(files, rootPath, nodes, nodeNameMap) {
  const rawLinks = [];

  for (const file of files) {
    const filePath = path.join(rootPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativeFile = file.replace(/\\/g, '/');

    nodeNameMap.forEach((ids, methodName) => {
      // Basic heuristic: Does the method name appear followed by '(' in this file?
      if (content.includes(methodName + "(")) {
        // Find a node that represents a function within this file to act as the caller.
        // For a more robust parser, we'd find the exact function scope. 
        // Here we just attribute the call to the first node found in the file as a fallback, 
        // or a specific main node if we could parse scope.
        const callerNode = nodes.find(n => n.file === relativeFile);
        if (callerNode) {
          ids.forEach(targetId => {
            if (callerNode.id !== targetId) {
              rawLinks.push({ source: callerNode.id, target: targetId });
            }
          });
        }
      }
    });
  }

  // Deduplicate and limit to prevent 3D rendering lag (Hairball prevention)
  const uniqueLinks = Array.from(new Set(rawLinks.map(l => JSON.stringify(l))))
    .map(s => JSON.parse(s))
    .slice(0, 5000); 

  return uniqueLinks;
}
