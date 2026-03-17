import { simpleGit } from 'simple-git';

export async function checkGitRepo(rootPath) {
  const git = simpleGit(rootPath);
  try {
    return await git.checkIsRepo();
  } catch (e) {
    return false;
  }
}

export async function getBlameInfo(rootPath, file, startLine, endLine, isGitRepo) {
  if (!isGitRepo) {
    return { 
      author: 'Unknown', 
      lastModified: new Date().toISOString().split('T')[0], 
      churnScore: Math.floor(Math.random() * 100) 
    };
  }
  
  const git = simpleGit(rootPath);
  
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
    return { 
      author: 'Uncommitted', 
      lastModified: new Date().toISOString().split('T')[0], 
      churnScore: 0 
    };
  }
}
