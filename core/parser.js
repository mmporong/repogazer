import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

async function parseProject(rootPath) {
  const files = await glob('**/*.{ts,js,cs}', { 
    cwd: rootPath, 
    ignore: ['node_modules/**', 'Library/**', 'Temp/**', 'web/**', '.git/**', 'Packages/**'] 
  });
  
  console.log(`Target files: ${files.length} scripts found.`);

  const nodes = [];
  const links = [];
  const nodeNameMap = new Map(); // For resolving calls

  // 1. First pass: Fast Regex Extraction of Classes and Methods
  for (const file of files) {
    const filePath = path.join(rootPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativeFile = file.replace(/\\/g, '/');

    // Regex for C# Classes and Methods (Common in Unity)
    const classRegex = /class\s+([a-zA-Z0-9_]+)/g;
    const methodRegex = /(?:public|private|protected|internal|static|virtual|override|async)\s+[a-zA-Z0-9_<>[\]]+\s+([a-zA-Z0-9_]+)\s*\(/g;

    let match;
    let currentClass = "Global";

    // Simplified parsing logic
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      // Find class
      const cMatch = /class\s+([a-zA-Z0-9_]+)/.exec(line);
      if (cMatch) currentClass = cMatch[1];

      // Find method
      const mMatch = /(?:public|private|protected|internal|static|virtual|override|async)\s+[a-zA-Z0-9_<>[\]]+\s+([a-zA-Z0-9_]+)\s*\((?![^;]*;)/.exec(line);
      if (mMatch) {
        const methodName = mMatch[1];
        if (['if', 'for', 'while', 'switch', 'catch', 'using', 'return'].includes(methodName)) return;

        const id = `${relativeFile}:${currentClass}.${methodName}`;
        const nodeInfo = {
          id,
          name: methodName,
          file: relativeFile,
          line: index + 1,
          val: 10, // Default weight
          snippet: line.trim()
        };
        nodes.push(nodeInfo);
        if (!nodeNameMap.has(methodName)) nodeNameMap.set(methodName, []);
        nodeNameMap.get(methodName).push(id);
      }
    });
  }

  // 2. Second pass: Basic Call Relationship Extraction
  // We look for method names inside other methods
  // To keep it simple and fast for huge projects, we use a string-based search
  for (const file of files) {
    const filePath = path.join(rootPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativeFile = file.replace(/\\/g, '/');

    // This is a rough heuristic: if a method name appears in the file, it's a link
    // Optimized: only search for names we actually found
    nodeNameMap.forEach((ids, methodName) => {
      if (content.includes(methodName + "(")) {
        // Find who is calling it (roughly)
        // For simplicity in a prototype, we link the file to the method
        // Or if we have a "main" like node, we link that.
        // Let's find a caller in the same file if possible
        const callerNode = nodes.find(n => n.file === relativeFile);
        if (callerNode) {
          ids.forEach(targetId => {
            if (callerNode.id !== targetId) {
              links.push({ source: callerNode.id, target: targetId });
            }
          });
        }
      }
    });
  }

  // Final Filtering and Cleaning
  const uniqueLinks = Array.from(new Set(links.map(l => JSON.stringify(l))))
    .map(s => JSON.parse(s))
    .slice(0, 3000); // Limit links for 3D performance if too many

  return { nodes, links: uniqueLinks };
}

const root = process.argv[2] || '.';
console.log(`Analyzing project at: ${path.resolve(root)}...`);

parseProject(path.resolve(root)).then(data => {
    fs.writeFileSync('project_data.json', JSON.stringify(data, null, 2));
    console.log(`Success! Mapped ${data.nodes.length} stars and ${data.links.length} gravitational links.`);
}).catch(err => {
    console.error('Parsing failed:', err);
});
