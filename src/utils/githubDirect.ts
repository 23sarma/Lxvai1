/**
 * Client-Side Direct GitHub Commit & Push Engine
 * Works anywhere: on Google AI Studio, on Vercel, on local browsers!
 * Directly pushes files using GitHub REST API v3
 */

export interface GitHubFileItem {
  path: string;
  content: string;
}

export interface DirectPushResult {
  success: boolean;
  pushedFiles: string[];
  commitSha?: string;
  repoUrl: string;
  error?: string;
}

export async function directPushToGitHub(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  files: GitHubFileItem[],
  commitMessage: string
): Promise<DirectPushResult> {
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const cleanToken = token.trim();
  const headers = {
    'Authorization': `token ${cleanToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  const pushedFiles: string[] = [];

  try {
    for (const file of files) {
      let sha: string | undefined;

      // 1. Get existing file sha if it exists
      try {
        const getRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`,
          { headers }
        );
        if (getRes.ok) {
          const getData = await getRes.json();
          sha = getData.sha;
        }
      } catch (e) {
        // File may not exist yet, which is totally fine
      }

      // 2. Put file with base64 encoded content (handling utf-8 safely)
      const utf8Bytes = new TextEncoder().encode(file.content);
      let binaryStr = '';
      for (let i = 0; i < utf8Bytes.length; i++) {
        binaryStr += String.fromCharCode(utf8Bytes[i]);
      }
      const base64Content = btoa(binaryStr);

      const putBody: any = {
        message: commitMessage,
        content: base64Content,
        branch: branch
      };
      if (sha) {
        putBody.sha = sha;
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
        pushedFiles.push(file.path);
      } else {
        const errData = await putRes.json().catch(() => ({}));
        console.error(`Failed to push ${file.path}:`, errData);
      }
    }

    return {
      success: pushedFiles.length > 0,
      pushedFiles,
      repoUrl
    };
  } catch (error: any) {
    return {
      success: false,
      pushedFiles,
      repoUrl,
      error: error?.message || 'Failed direct GitHub push'
    };
  }
}
