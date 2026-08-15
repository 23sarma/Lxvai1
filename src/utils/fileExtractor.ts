/**
 * Intelligent Code & Multi-File Extractor for GitHub Repository Commits
 * Extracts file paths from code fences, headers, comments, and contextual prompts
 */

export interface ExtractedFile {
  path: string;
  content: string;
}

export function extractFilesFromAiResponse(response: string, userPrompt: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  const codeBlockRegex = /```(?:([a-zA-Z0-9_\-\.\/:]+)\n)?([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  let blockIndex = 1;
  while ((match = codeBlockRegex.exec(response)) !== null) {
    const rawHeader = (match[1] || '').trim();
    const codeContent = match[2].trim();

    if (!codeContent || codeContent.length < 5) continue;

    let detectedPath = '';

    // Check 1: In the fence header e.g. ```tsx:src/App.tsx, ```src/components/MyFile.tsx, ```html:index.html
    if (rawHeader.includes('/') || rawHeader.includes('.')) {
      detectedPath = rawHeader
        .replace(/^(typescript|javascript|tsx|jsx|python|html|css|json|bash|sh|ts|js):/i, '')
        .trim();
    }

    // Check 2: First line comment inside the code block e.g. // File: src/App.tsx, // filepath: index.html, # file: main.py
    if (!detectedPath) {
      const firstLine = codeContent.split('\n')[0].trim();
      const fileCommentMatch = firstLine.match(/^(?:\/\/|#|\/\*|<!--)\s*(?:File|Filename|Path|filepath|file|Target):\s*([a-zA-Z0-9_\-\.\/]+)/i);
      if (fileCommentMatch && fileCommentMatch[1]) {
        detectedPath = fileCommentMatch[1].trim();
      }
    }

    // Check 3: Look at text right before this code block (up to 200 characters before)
    if (!detectedPath) {
      const matchIndex = match.index;
      const precedingText = response.substring(Math.max(0, matchIndex - 200), matchIndex);
      const preMatch = precedingText.match(/(?:file|filename|modify|update|created?|rewrite|path|in|to)\s*[`"']?([a-zA-Z0-9_\-\/]+\.[a-zA-Z0-9]+)[`"']?/i);
      if (preMatch && preMatch[1] && (preMatch[1].includes('/') || preMatch[1].includes('.'))) {
        detectedPath = preMatch[1].trim();
      }
    }

    // Check 4: Infer exact paths based on explicit user prompt keywords
    if (!detectedPath) {
      const pLower = userPrompt.toLowerCase();
      if (pLower.includes('app.tsx') || pLower.includes('src/app') || (pLower.includes('ui') && rawHeader.includes('tsx'))) {
        detectedPath = blockIndex === 1 ? 'src/App.tsx' : `src/components/Component_${blockIndex}.tsx`;
      } else if (pLower.includes('server.ts') || pLower.includes('backend') || pLower.includes('server')) {
        detectedPath = 'server.ts';
      } else if (pLower.includes('index.html')) {
        detectedPath = 'index.html';
      } else if (pLower.includes('package.json')) {
        detectedPath = 'package.json';
      } else if (pLower.includes('vite.config')) {
        detectedPath = 'vite.config.ts';
      } else if (pLower.includes('tailwind.config')) {
        detectedPath = 'tailwind.config.js';
      } else if (rawHeader.includes('py') || pLower.includes('python')) {
        detectedPath = 'main.py';
      } else {
        const ext = rawHeader.includes('json') ? 'json' : rawHeader.includes('html') ? 'html' : rawHeader.includes('css') ? 'css' : rawHeader.includes('tsx') ? 'tsx' : 'ts';
        const cleanSlug = userPrompt.split(' ').map(w => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()).filter(w => w.length > 2 && !['and', 'the', 'for', 'with', 'karo', 'bonao', 'banao', 'mujhe', 'nahi'].includes(w)).slice(0, 2).join('_') || `module_${Date.now()}`;
        detectedPath = `src/modules/${cleanSlug}_${blockIndex}.${ext}`;
      }
    }

    // Sanitize path (strip leading slash, backticks, quotes)
    detectedPath = detectedPath.replace(/^[\/\\`'"]+|[\/\\`'"]+$/g, '').trim();

    if (detectedPath && !files.some(f => f.path === detectedPath)) {
      files.push({
        path: detectedPath,
        content: codeContent
      });
      blockIndex++;
    }
  }

  // If no code fences were found, but prompt demands modifying or creating in repo
  if (files.length === 0 && (
    userPrompt.toLowerCase().includes('update') || 
    userPrompt.toLowerCase().includes('commit') || 
    userPrompt.toLowerCase().includes('banao') || 
    userPrompt.toLowerCase().includes('modify') || 
    userPrompt.toLowerCase().includes('repo')
  )) {
    const slug = userPrompt.split(' ').map(w => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()).filter(w => w.length > 2).slice(0, 3).join('_') || `update_${Date.now()}`;
    files.push({
      path: `src/modules/${slug}.ts`,
      content: `/**\n * Aegis Autonomous AI Generated Module\n * Directive from Master Lobish: ${userPrompt}\n * Generated: ${new Date().toISOString()}\n */\n\nexport const directive = ${JSON.stringify(userPrompt)};\nexport async function run() {\n  console.log('[AEGIS] Running ${slug}...');\n  return { success: true, timestamp: "${new Date().toISOString()}" };\n}\n`
    });
  }

  return files;
}
