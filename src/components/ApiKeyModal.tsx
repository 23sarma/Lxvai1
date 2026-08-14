import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Key,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Zap,
  ExternalLink,
  ShieldCheck,
  Trash2,
  RefreshCw,
  Sparkles,
  Server
} from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeySaved
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{
    isOnline: boolean;
    hasKey: boolean;
    isCustomStored: boolean;
    maskedKey: string;
    engineName?: string;
    source?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fetchKeyStatus = async () => {
    try {
      const res = await fetch('/api/key/status');
      if (res.ok) {
        const data = await res.json();
        setKeyStatus(data);
      }
    } catch (e) {
      console.log('Error fetching key status:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKeyStatus();
      setMessage(null);
      setApiKeyInput('');
    }
  }, [isOpen]);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim() || apiKeyInput.trim().length < 8) {
      setMessage({ text: 'Kripya ek valid Google Gemini API Key enter karein (e.g. AIzaSy...).', type: 'error' });
      return;
    }

    const clean = apiKeyInput.trim();
    setIsLoading(true);
    setMessage(null);

    // Save to permanent browser storage immediately for lifetime persistence
    try {
      localStorage.setItem('aegis_gemini_api_key', clean);
      localStorage.setItem('aegis_permanent_key_active', 'true');
    } catch (e) {}

    try {
      const res = await fetch('/api/key/save', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-gemini-api-key': clean
        },
        body: JSON.stringify({ apiKey: clean })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ text: '✅ Lifetime Permanent Key successfully saved! Har update, restart ya reopen par dubara enter nahi karni padegi.', type: 'success' });
        setApiKeyInput('');
        await fetchKeyStatus();
        if (onKeySaved) onKeySaved();
      } else {
        setMessage({ text: data.error || 'API Key save nahi ho saki.', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: `Connection error: ${err?.message || 'Server tak reach nahi ho payi'}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestKey = async () => {
    setIsTesting(true);
    setMessage(null);
    const candidate = apiKeyInput.trim() || localStorage.getItem('aegis_gemini_api_key') || undefined;

    try {
      const res = await fetch('/api/key/test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(candidate ? { 'x-gemini-api-key': candidate } : {})
        },
        body: JSON.stringify({ apiKey: candidate })
      });

      const data = await res.json();
      if (data.success && data.isOnline) {
        setMessage({ text: '🟢 Success! Google API Key 100% active, online aur working hai.', type: 'success' });
      } else {
        setMessage({ text: data.error || 'Test fail hua. Kripya check karein ki key sahi hai.', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: `Test error: ${err?.message}`, type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!window.confirm('Kya aap saved Google API Key hatana chahte hain?')) return;
    setIsLoading(true);
    try {
      localStorage.removeItem('aegis_gemini_api_key');
      localStorage.removeItem('aegis_permanent_key_active');
    } catch (e) {}
    try {
      const res = await fetch('/api/key/delete', { method: 'POST' });
      if (res.ok) {
        setMessage({ text: 'Saved API Key successfully remove ho gayi.', type: 'info' });
        await fetchKeyStatus();
        if (onKeySaved) onKeySaved();
      }
    } catch (err) {
      console.log(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200"
        >
          {/* Header */}
          <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-cyan-500/15 border border-cyan-500/30 rounded-xl text-cyan-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center space-x-2">
                  <span>Google Gemini API Key Config</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Deployment Ready
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  AEGIS AI ko online rakhne ke liye yahan apni Google API Key set karein
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            {/* Live Online Status Card */}
            <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-mono">Current Engine Status:</span>
                  {keyStatus?.isOnline ? (
                    <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/40 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>🟢 100% ONLINE & ACTIVE</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-rose-400 bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-500/40 font-mono">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      <span>🔴 OFFLINE (Key Required)</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {keyStatus?.hasKey ? (
                    <span>Active Key: <strong className="text-cyan-300 font-mono">{keyStatus.maskedKey}</strong> ({keyStatus.source})</span>
                  ) : (
                    <span>Koi saved key nahi mili. Niche apni Google API key dalein.</span>
                  )}
                </div>
              </div>

              {keyStatus?.isCustomStored && (
                <button
                  type="button"
                  onClick={handleDeleteKey}
                  disabled={isLoading}
                  className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-rose-500/30 rounded-lg text-xs transition flex items-center space-x-1"
                  title="Remove Saved Key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Notification Banner */}
            {message && (
              <div
                className={`p-3 rounded-xl text-xs font-medium border flex items-start space-x-2 ${
                  message.type === 'success'
                    ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                    : message.type === 'error'
                    ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                    : 'bg-cyan-950/50 border-cyan-500/40 text-cyan-300'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            {/* API Key Form */}
            <form onSubmit={handleSaveKey} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-semibold text-slate-300 flex items-center justify-between">
                  <span>Enter Google Gemini API Key:</span>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 text-[11px] underline font-sans"
                  >
                    <span>Free Key Lein (Google AI Studio)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </label>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={keyStatus?.hasKey ? `Currently Active: ${keyStatus.maskedKey} (Paste new to update)` : 'AIzaSy...'}
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl text-xs font-mono text-white placeholder-slate-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !apiKeyInput.trim()}
                  className="flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving & Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Save & Bring AI Online</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={isTesting}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isTesting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>Test Key Live</span>
                </button>
              </div>
            </form>

            {/* Helper Info Note */}
            <div className="p-3 bg-cyan-950/30 border border-cyan-800/30 rounded-xl space-y-1 text-[11px] text-cyan-200/90 font-mono">
              <p className="font-bold flex items-center space-x-1 text-cyan-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Zero-Third-Party Requirement:</span>
              </p>
              <p className="text-slate-400">
                Aapko sirf ek Google API Key dalni hai. Kisi dusri website ya third-party service ki extra API key ki koi zaroorat nahi hai. Yeh key deployment ke baad bhi saved rahegi.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
