// Intelligent Self-Repair, Auto-Sanitization & Safe JSON Transport for Gemini API Keys

export function autoRepairAndCleanApiKey(rawInput: any): string {
  if (!rawInput || typeof rawInput !== 'string') return '';
  let str = String(rawInput).trim();
  if (!str) return '';

  // Remove zero-width spaces, invisible unicode, HTML entities, and outer quotes
  str = str.replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F]/g, '').trim();
  str = str.replace(/^["'`]|["'`]$/g, '').trim();

  // If JSON pasted, extract apiKey, key, token or private_key
  if (str.includes('{') && str.includes('}')) {
    try {
      const parsed = JSON.parse(str);
      const extracted = parsed.apiKey || parsed.key || parsed.token || parsed.api_key;
      if (extracted && typeof extracted === 'string') {
        str = extracted.trim();
      }
    } catch {}
  }

  // 1. Precise Regex Extraction for standard Google Gemini API Keys (AIzaSy...)
  const aizaMatch = str.match(/AIza[0-9A-Za-z-_]{25,60}/);
  if (aizaMatch && aizaMatch[0]) {
    return aizaMatch[0];
  }

  // 2. Bearer token format
  if (str.startsWith('Bearer ') || str.startsWith('bearer ')) {
    str = str.slice(7).trim();
  }

  // 3. If embedded in a URL or query string (e.g. key=AIza... or api_key=...)
  const queryMatch = str.match(/(?:key|api_key|token|auth)=([0-9A-Za-z-_]{20,80})/i);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }

  // 4. General cleanup: strip non-standard characters, spaces, and punctuation
  const cleaned = str.replace(/[\s\r\n\t,;:"'\\/<>]/g, '');
  if (cleaned.length >= 15) {
    return cleaned;
  }

  return str.trim();
}

export function getStoredClientApiKey(): string {
  try {
    const key = localStorage.getItem('aegis_gemini_api_key');
    if (key && key.length > 10) {
      return autoRepairAndCleanApiKey(key);
    }
  } catch (e) {}
  return '';
}

export function setStoredClientApiKey(key: string): void {
  try {
    const clean = autoRepairAndCleanApiKey(key);
    if (clean && clean.length > 10) {
      localStorage.setItem('aegis_gemini_api_key', clean);
      localStorage.setItem('aegis_permanent_key_active', 'true');
    }
  } catch (e) {}
}

export function clearStoredClientApiKey(): void {
  try {
    localStorage.removeItem('aegis_gemini_api_key');
    localStorage.removeItem('aegis_permanent_key_active');
  } catch (e) {}
}

// Resilient JSON fetch that NEVER throws "Unexpected token 'A', is not valid JSON"
export async function safeJsonFetch(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      // If server returned plain text or html error, handle gracefully
      data = {
        success: res.ok,
        isOnline: res.ok,
        error: text ? text.replace(/<[^>]*>/g, '').trim().slice(0, 150) : `HTTP ${res.status} Response`
      };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: { success: false, isOnline: false, error: err?.message || 'Network connection issue' }
    };
  }
}
