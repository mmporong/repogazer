import fs from 'fs';
import path from 'path';
import { getBlameInfo } from '../utils/gitBlame.js';

export async function extractNodes(files, rootPath, isGitRepo) {
  const nodes = [];
  const nodeNameMap = new Map();

  for (const file of files) {
    const filePath = path.join(rootPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativeFile = file.replace(/\\/g, '/');

    let currentClass = "Global";
    const lines = content.split('\n');
    const methodRanges = [];

    lines.forEach((line, index) => {
      // Find Class
      const cMatch = /class\s+([a-zA-Z0-9_]+)/.exec(line);
      if (cMatch) currentClass = cMatch[1];

      // Find Method (C#, JS, TS simple heuristic)
      const mMatch = /(?:public|private|protected|internal|static|virtual|override|async|function)\s+[a-zA-Z0-9_<>[\]]*\s*([a-zA-Z0-9_]+)\s*\((?![^;]*;)/.exec(line);
      if (mMatch) {
        const methodName = mMatch[1];
        if (['if', 'for', 'while', 'switch', 'catch', 'using', 'return', 'new'].includes(methodName)) return;
        
        methodRanges.push({
            name: methodName,
            className: currentClass,
            start: index + 1,
            snippet: line.trim()
        });
      }
    });

    for (let i = 0; i < methodRanges.length; i++) {
        const m = methodRanges[i];
        const endLine = i < methodRanges.length - 1 ? methodRanges[i+1].start - 1 : lines.length;
        const lineCount = endLine - m.start + 1;
        
        const blame = await getBlameInfo(rootPath, file, m.start, endLine, isGitRepo);

        const id = `${relativeFile}:${m.className}.${m.name}`;
        const nodeInfo = {
          id,
          name: m.name,
          file: relativeFile,
          line: m.start,
          val: lineCount > 0 ? lineCount : 10,
          snippet: m.snippet,
          author: blame.author,
          lastModified: blame.lastModified,
          churnScore: blame.churnScore,
          inDegree: 0,
          outDegree: 0,
          isGodObject: false,
          isDeadCode: false
        };
        
        nodes.push(nodeInfo);
        if (!nodeNameMap.has(m.name)) nodeNameMap.set(m.name, []);
        nodeNameMap.get(m.name).push(id);
    }
  }

  return { nodes, nodeNameMap };
}
