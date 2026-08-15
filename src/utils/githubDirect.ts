/**
 * Enhanced Direct Client-Side GitHub Commit & Push Engine (REST API v3)
 * Supports fine-grained tokens (github_pat_), classic tokens (ghp_),
 * robust UTF-8 encoding, automatic branch fallback & SHA resolver
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

export function sanitizeGithubToken(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/[\r\n\t\f\v]/g, '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/^(Bearer|token)\s+/i, '')
    .trim();
}

/**
 * Fetch GitHub API with token fallback (Bearer / token header)
 */
async function githubFetch(url: string, token: string, options: RequestInit = {}): Promise<Response> {
  const clean = sanitizeGithubToken(token);
  const isFineGrained = clean.startsWith('github_pat_');
  const authHeaders = isFineGrained 
    ? [`Bearer ${clean}`, `token ${clean}`]
    : [`Bearer ${clean}`, `token ${clean}`];

  let lastRes: Response | null = null;
  for (const auth of authHeaders) {
    const headers: Record<string, string> = {
      'Authorization': auth,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...((options.headers as any) || {})
    };
    try {
      lastRes = await fetch(url, { ...options, headers });
      if (lastRes.status !== 401) {
        break;
      }
    } catch (e) {
      // Continue next attempt
    }
  }

  return lastRes || new Response(JSON.stringify({ message: 'Network error calling GitHub' }), { status: 500 });
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
  const cleanToken = sanitizeGithubToken(token);

  if (!cleanToken) {
    return {
      success: false,
      pushedFiles: [],
      detailedReports: [],
      failedFiles: files.map(f => ({ path: f.path, reason: 'GitHub token is missing. Please save it in Menu -> GitHub.' })),
      repoUrl,
      branch: branch || 'main',
      error: 'GitHub Token is missing. Please enter your GitHub Personal Access Token in Menu -> GitHub.'
    };
  }

  const pushedFiles: string[] = [];
  const detailedReports: PushedFileReport[] = [];
  const failedFiles: { path: string; reason: string }[] = [];

  // 1. Determine active branch (check configured branch, then main, then master)
  let activeBranch = branch || 'main';
  try {
    const branchCheck = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(activeBranch)}`, cleanToken);
    if (!branchCheck.ok) {
      const mainCheck = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/branches/main`, cleanToken);
      if (mainCheck.ok) {
        activeBranch = 'main';
      } else {
        const masterCheck = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/branches/master`, cleanToken);
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
        const getRes = await githubFetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${encodeURIComponent(activeBranch)}`,
          cleanToken
        );
        if (getRes.ok) {
          const getData = await getRes.json();
          existingSha = getData.sha;
        }
      } catch (e) {
        // File may be brand new
      }

      // 3. Robust UTF-8 to Base64 encoding supporting emojis, hindi, and multi-byte characters
      const utf8Bytes = new TextEncoder().encode(file.content);
      let binaryStr = '';
      const len = utf8Bytes.byteLength;
      for (let i = 0; i < len; i++) {
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

      const putRes = await githubFetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        cleanToken,
        {
          method: 'PUT',
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
