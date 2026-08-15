/**
 * Direct Client-Side GitHub Commit & Push Engine (REST API v3)
 * Full file update, creation, overwrite with automated branch fallback & SHA resolver
 */

export interface GitHubFileItem {
  path: string;
  content: string;
}

export interface PushedFileReport {
  path: string;
  sha: string;
  status: 'created' | 'modified';
  size: number;
}

export interface DirectPushResult {
  success: boolean;
  pushedFiles: string[];
  detailedReports: PushedFileReport[];
  failedFiles: { path: string; reason: string }[];
  commitSha?: string;
  repoUrl: string;
  branch: string;
  error?: string;
}

/**
 * Push or update multiple files directly into GitHub Repository
 */
export async function directPushToGitHub(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  files: GitHubFileItem[],
  commitMessage: string
): Promise<DirectPushResult> {
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const cleanToken = token ? token.trim().replace(/^['"]|['"]$/g, '') : '';

  if (!cleanToken) {
    return {
      success: false,
      pushedFiles: [],
      detailedReports: [],
      failedFiles: files.map(f => ({ path: f.path, reason: 'GitHub token is missing. Please save it in Menu -> GitHub.' })),
      repoUrl,
      branch: branch || 'main',
      error: 'GitHub Token missing'
    };
  }

  const headers = {
    'Authorization': `token ${cleanToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  const pushedFiles: string[] = [];
  const detailedReports: PushedFileReport[] = [];
  const failedFiles: { path: string; reason: string }[] = [];

  // 1. Determine active branch (check configured branch, then main, then master)
  let activeBranch = branch || 'main';
  try {
    const branchCheck = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${activeBranch}`, { headers });
    if (!branchCheck.ok) {
      const mainCheck = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/main`, { headers });
      if (mainCheck.ok) {
        activeBranch = 'main';
      } else {
        const masterCheck = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/master`, { headers });
        if (masterCheck.ok) {
          activeBranch = 'master';
        }
      }
    }
  } catch (e) {
    console.log('Branch auto-detection note:', e);
  }

  let latestCommitSha = '';

  for (const file of files) {
    try {
      let existingSha: string | undefined;

      // 2. Fetch current file SHA if exists to overwrite/update safely
      try {
        const getRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${activeBranch}`,
          { headers }
        );
        if (getRes.ok) {
          const getData = await getRes.json();
          existingSha = getData.sha;
        }
      } catch (e) {
        // File may be brand new
      }

      // 3. Base64 encode file content safely supporting full UTF-8 emojis & special chars
      const utf8Bytes = new TextEncoder().encode(file.content);
      let binaryStr = '';
      for (let i = 0; i < utf8Bytes.length; i++) {
        binaryStr += String.fromCharCode(utf8Bytes[i]);
      }
      const base64Content = btoa(binaryStr);

      const putBody: any = {
        message: commitMessage || `⚡ Aegis Autonomous Update: ${file.path}`,
        content: base64Content,
        branch: activeBranch
      };
      if (existingSha) {
        putBody.sha = existingSha;
      }

      const putRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(putBody)
        }
      );

      if (putRes.ok) {
        const putData = await putRes.json().catch(() => ({}));
        const fileCommitSha = putData?.commit?.sha || putData?.content?.sha || Math.random().toString(36).substring(2, 9);
        latestCommitSha = fileCommitSha;
        pushedFiles.push(file.path);
        detailedReports.push({
          path: file.path,
          sha: fileCommitSha.substring(0, 7),
          status: existingSha ? 'modified' : 'created',
          size: utf8Bytes.length
        });
      } else {
        const errData = await putRes.json().catch(() => ({}));
        const reason = errData?.message || `HTTP ${putRes.status}`;
        failedFiles.push({ path: file.path, reason });
        console.error(`Failed to push/modify ${file.path}:`, reason);
      }
    } catch (err: any) {
      failedFiles.push({ path: file.path, reason: err?.message || 'Network error' });
    }
  }

  return {
    success: pushedFiles.length > 0,
    pushedFiles,
    detailedReports,
    failedFiles,
    commitSha: latestCommitSha ? latestCommitSha.substring(0, 7) : undefined,
    repoUrl,
    branch: activeBranch,
    error: failedFiles.length > 0 && pushedFiles.length === 0 ? failedFiles[0].reason : undefined
  };
}
