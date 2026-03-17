import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { checkGitRepo } from './utils/gitBlame.js';
import { extractNodes } from './analyzers/regexExtractor.js';
import { mapDependencies } from './analyzers/dependencyLinker.js';
import { calculateTechDebt } from './analyzers/techDebtRadar.js';

async function main() {
  const rootPath = path.resolve(process.argv[2] || '.');
  console.log(`🚀 RepoGazer Pipeline Started at: ${rootPath}`);

  // 1. Initialize Pipeline & Check Git status
  const isGitRepo = await checkGitRepo(rootPath);
  if (isGitRepo) {
    console.log("✅ Git repository detected. Git Blame Heatmap will be generated.");
  } else {
    console.warn("⚠️ Not a Git repository. Fallback dummy data will be used for Heatmap.");
  }

  // 2. Discover Files
  const files = await glob('**/*.{ts,js,cs}', { 
    cwd: rootPath, 
    ignore: ['node_modules/**', 'Library/**', 'Temp/**', 'web/**', '.git/**', 'Packages/**'] 
  });
  console.log(`📦 Found ${files.length} script files.`);

  // 3. Extract Nodes (Classes, Methods) + Git Blame
  console.log("🔍 Extracting abstract syntax nodes and authorship data...");
  let { nodes, nodeNameMap } = await extractNodes(files, rootPath, isGitRepo);

  // 4. Map Dependencies (Links)
  console.log("🔗 Mapping gravitational dependencies (Call Graph)...");
  const links = mapDependencies(files, rootPath, nodes, nodeNameMap);

  // 5. Calculate Architectural Tech Debt
  console.log("🔎 Scanning for Technical Debt (God Objects & Dead Code)...");
  nodes = calculateTechDebt(nodes, links);

  // 6. Output Generation
  const result = { nodes, links };
  const outputPath = path.join(process.cwd(), 'project_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

  console.log(`✨ Success! Generated ${nodes.length} stars and ${links.length} gravitational links.`);
  console.log(`💾 Saved to: ${outputPath}`);
}

main().catch(err => {
  console.error("❌ Pipeline crashed:", err);
  process.exit(1);
});
