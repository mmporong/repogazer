import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { simpleGit } from 'simple-git';

async function parseProject(rootPath) {
  const git = simpleGit(rootPath);
  const isGitRepo = await git.checkIsRepo();
  if (!isGitRepo) {
    console.warn("⚠️ Not a Git repository. Git blame features will use fallback data.");
  } else {
    console.log("✅ Git repository detected. Extracting blame data...");
  }

  const files = await glob('**/*.{ts,js,cs}', { 
    cwd: rootPath, 
    ignore: ['node_modules/**', 'Library/**', 'Temp/**', 'web/**', '.git/**', 'Packages/**'] 
  });
  
  console.log(`Target files: ${files.length} scripts found.`);

  const nodes = [];
  const rawLinks = [];
  const nodeNameMap = new Map();

  async function getBlameInfo(file, startLine, endLine) {
    if (!isGitRepo) return { author: 'Unknown', lastModified: new Date().toISOString().split('T')[0], churnScore: Math.floor(Math.random() * 100) };
    
    try {
      const blameResult = await git.raw(['blame', '-L', `${startLine},${endLine}`, '--line-porcelain', file]);
      const authors = {};
      let latestDate = 0;

      const lines = blameResult.split('\n');
      for (let line of lines) {
        if (line.startsWith('author ')) {
          const author = line.substring(7).trim();
          authors[author] = (authors[author] || 0) + 1;
        } else if (line.startsWith('author-time ')) {
          const time = parseInt(line.substring(12).trim()) * 1000;
          if (time > latestDate) latestDate = time;
        }
      }

      let mainAuthor = 'Unknown';
      let maxLines = 0;
      for (const [author, count] of Object.entries(authors)) {
        if (count > maxLines) {
          mainAuthor = author;
          maxLines = count;
        }
      }

      const daysSinceModify = (Date.now() - latestDate) / (1000 * 60 * 60 * 24);
      let churnScore = Math.max(0, 100 - (daysSinceModify / 2)); 

      return {
        author: mainAuthor,
        lastModified: new Date(latestDate).toISOString().split('T')[0],
        churnScore: Math.round(churnScore)
      };
    } catch (err) {
      return { author: 'Uncommitted', lastModified: new Date().toISOString().split('T')[0], churnScore: 0 };
    }
  }

  for (const file of files) {
    const filePath = path.join(rootPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativeFile = file.replace(/\\/g, '/');

    let currentClass = "Global";
    const lines = content.split('\n');
    const methodRanges = [];

    lines.forEach((line, index) => {
      const cMatch = /class\s+([a-zA-Z0-9_]+)/.exec(line);
      if (cMatch) currentClass = cMatch[1];

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
        
        const blame = await getBlameInfo(file, m.start, endLine);

        const id = `${relativeFile}:${m.className}.${m.name}`;
        nodes.push({
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
        });
        
        if (!nodeNameMap.has(m.name)) nodeNameMap.set(m.name, []);
        nodeNameMap.get(m.name).push(id);
    }
  }

  for (const file of files) {
    const filePath = path.join(rootPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativeFile = file.replace(/\\/g, '/');

    nodeNameMap.forEach((ids, methodName) => {
      if (content.includes(methodName + "(")) {
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

  const uniqueLinks = Array.from(new Set(rawLinks.map(l => JSON.stringify(l))))
    .map(s => JSON.parse(s))
    .slice(0, 5000); 

  uniqueLinks.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    if (sourceNode) sourceNode.outDegree++;
    if (targetNode) targetNode.inDegree++;
  });

  nodes.forEach(n => {
    if (n.outDegree > 15 || n.val > 300) n.isGodObject = true;
    const entryPoints = ['Start', 'Update', 'Awake', 'main', 'OnEnable', 'OnDisable'];
    if (n.inDegree === 0 && !entryPoints.includes(n.name)) {
      n.isDeadCode = true;
    }
  });

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
