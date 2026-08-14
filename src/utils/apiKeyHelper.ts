// Intelligent Self-Repair, Auto-Sanitization & Safe JSON Transport for Gemini API Keys

export function autoRepairAndCleanApiKey(rawInput: any): string {
  if (!rawInput || typeof rawInput !== 'string') return '';
  let str = String(rawInput).trim();
  if (!str) return '';

  // Remove zero-width spaces, invisible unicode, HTML entities, and outer quotes
  str = str.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();
  str = str.replace(/^["'`]|["'`]$/g, '').trim();

  // 1. Precise Regex Extraction for standard Google Gemini API Keys (AIzaSy...)
  const aizaMatch = str.match(/AIza[0-9A-Za-z-_]{30,45}/);
  if (aizaMatch && aizaMatch[0]) {
    return aizaMatch[0];
  }

  // 2. If embedded in a URL or query string (e.g. key=AIza... or api_key=...)
  const queryMatch = str.match(/(?:key|api_key|token)=([0-9A-Za-z-_]{25,50})/i);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }

  // 3. General cleanup: strip non-standard characters, spaces, and punctuation
  str = str.replace(/[\s\r\n\t,;:"'\\/<>]/g, '');
  return str;
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
