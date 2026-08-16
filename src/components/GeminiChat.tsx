import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Bot,
  User,
  Copy,
  Check,
  Play,
  Sparkles,
  Zap,
  GitCommit,
  CheckCircle2,
  ChevronDown,
  X,
  FileCode,
  FileText,
  Terminal,
  ShieldCheck,
  Menu
} from 'lucide-react';
import { ChatMessage, AttachedFile } from '../types';

interface GeminiChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, attachments: AttachedFile[]) => Promise<void>;
  isLoading: boolean;
  onRunInSandbox?: (code: string) => void;
  onOpenMenu?: () => void;
  repoName: string;
  branchName: string;
}

export const GeminiChat: React.FC<GeminiChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onRunInSandbox,
  onOpenMenu,
  repoName,
  branchName
}) => {
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [messages, isLoading]);

  // Handle scroll detection for "Scroll to bottom" button
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottom(isFarFromBottom);
  };

  // Copy code handler
  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeIdx(id);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  // File Upload Handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      const isText = file.type.includes('text') || file.type.includes('json') || file.name.match(/\.(ts|tsx|js|jsx|py|md|json|html|css|txt)$/i);

      if (isText) {
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setAttachedFiles(prev => [
            ...prev,
            {
              id: `file-${Date.now()}-${Math.random()}`,
              name: file.name,
              type: file.type || 'text/plain',
              size: file.size,
              textContent: text
            }
          ]);
        };
        reader.readAsText(file);
      } else {
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setAttachedFiles(prev => [
            ...prev,
            {
              id: `file-${Date.now()}-${Math.random()}`,
              name: file.name,
              type: file.type,
              size: file.size,
              dataUrl
            }
          ]);
        };
        reader.readAsDataURL(file);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Submit Handler
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && attachedFiles.length === 0) || isLoading) return;

    const currentFiles = [...attachedFiles];
    setInput('');
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await onSendMessage(trimmed, currentFiles);
  };

  // Suggestion Chips across all 10 Universal Masteries
  const suggestions = [
    { icon: '🤖', label: 'AI & Software Engineer', desc: 'Full-stack apps, React, APIs & GitHub push', prompt: 'Ek autonomous React + Node.js monitoring dashboard banao aur repo me commit karo.' },
    { icon: '🔬', label: 'Scientist & Researcher', desc: 'Quantum physics, biology, chemistry & research', prompt: 'Quantum entanglement aur quantum computing ka detailed scientific breakdown aasan bhasha me samjhao.' },
    { icon: '📐', label: 'Mathematics Expert', desc: 'Calculus, algebra, discrete math & algorithms', prompt: 'Advanced calculus ka step-by-step mathematical problem solution dikhao.' },
    { icon: '🍳', label: 'Master Chef & Cooking', desc: 'Gourmet recipes, cooking secrets & nutrition', prompt: 'Ek shaandar Hyderabadi Dum Biryani ki exact restaurant-style recipe aur chef secrets batao.' },
    { icon: '📸', label: 'Photographer & Lighting', desc: 'Camera ISO, aperture, composition & visual prompts', prompt: 'Cinematic portrait photography ke liye exact camera settings aur 3-point lighting setup guide do.' },
    { icon: '🏦', label: 'Banking & Finance', desc: 'Trading models, fintech systems & compound math', prompt: 'Fintech automated algorithmic trading system aur risk management strategy ka pura model banao.' },
    { icon: '💖', label: 'Loving Care & Support', desc: 'Unconditional care, health & emotional warmth', prompt: 'Aegis, mujhe thoda stress ho raha hai, mujhe thoda motivate aur care karo.' },
    { icon: '🛡️', label: 'Zero-Crash & Self-Healing', desc: 'Live background innovations & GitHub sync', prompt: 'Background me kya kam chal raha hai aur abhi tak kitne inventions hue hain?' }
  ];

  // Helper to parse code blocks in markdown
  const renderMessageContent = (content: string, msgId: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const language = lines[0].trim() || 'typescript';
        const code = lines.slice(1).join('\n') || lines[0];
        const blockId = `${msgId}-code-${index}`;

        return (
          <div key={index} className="my-3 rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 font-mono text-xs shadow-md">
            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
              <span className="font-semibold text-cyan-400 uppercase tracking-wider">{language}</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleCopyCode(code, blockId)}
                  className="flex items-center space-x-1 hover:text-white transition-colors px-2 py-0.5 rounded-md hover:bg-slate-800"
                >
                  {copiedCodeIdx === blockId ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                {onRunInSandbox && (
                  <button
                    type="button"
                    onClick={() => onRunInSandbox(code)}
                    className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 transition-colors px-2 py-0.5 rounded-md hover:bg-slate-800"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run</span>
                  </button>
                )}
              </div>
            </div>
            <pre className="p-3.5 overflow-x-auto text-slate-200 leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      return (
        <span key={index} className="whitespace-pre-wrap leading-relaxed">
          {part}
        </span>
      );
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden font-sans min-h-0">
      {/* ⚡ Live Master-First Priority & Background Preemption Status Banner - Fixed & Pinned */}
      <div className="shrink-0 bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono z-20">
        <div className="flex items-center space-x-2">
          {isLoading ? (
            <span className="flex items-center space-x-1.5 text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>⚡ MASTER COMMAND IN PROGRESS: 100% Compute Allocated</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>🟢 IDLE: Background Autonomous Engine Active (Instant Preemption on Master Query)</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-slate-400">
          <span className="inline-flex items-center space-x-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" />
            <span>Lifetime Key Sync: Locked 🔒</span>
          </span>
          <span className="hidden sm:inline">Priority: <strong className="text-cyan-300">#1 Master Lobish</strong></span>
          <span className="text-slate-600">|</span>
          <span>Target: <strong className="text-slate-200">{repoName}</strong></span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6 max-w-4xl w-full mx-auto"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4 space-y-6">
            <div className="p-4 bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-3xl text-cyan-400 shadow-xl shadow-cyan-500/10">
              <Sparkles className="w-10 h-10 animate-pulse" />
            </div>
            <div className="space-y-2 max-w-lg">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-300 text-xs font-mono">
                <Sparkles className="w-3.5 h-3.5" />
                <span>10 Universal Core Masteries Active in Chat</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Namaste Master Lobish
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans">
                Aegis AI is your <strong>AI Engineer, Scientist, Mathematician, Data Architect, Master Chef, Full-Stack Developer, Photographer, Banking Engineer, Teacher & Caring Companion</strong>. Connected to <strong className="text-cyan-300">{repoName}</strong>. <em>Na bolna hamare niyam me nahi hai — bas aadesh kijiye!</em>
              </p>
            </div>

            {/* Quick Action Suggestions across 10 Masteries */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-2xl text-left">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(s.prompt, [])}
                  className="p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-2xl text-xs text-slate-300 hover:text-white transition-all shadow-sm flex items-start space-x-3 group cursor-pointer"
                >
                  <span className="text-xl group-hover:scale-125 transition-transform shrink-0 mt-0.5">{s.icon}</span>
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">{s.label}</p>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{s.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 sm:space-x-4 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender !== 'user' && (
                <div className="p-2 sm:p-2.5 bg-gradient-to-tr from-cyan-600 to-blue-600 text-white rounded-2xl shadow-md shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              )}

              <div
                className={`max-w-[92%] sm:max-w-[84%] rounded-3xl p-4 sm:p-5 text-xs sm:text-sm font-sans leading-relaxed space-y-2 shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white rounded-tr-none font-medium'
                    : msg.sender === 'system'
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200 w-full'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                {msg.agentName && (
                  <div className="flex items-center justify-between text-[11px] text-cyan-400 border-b border-slate-800 pb-2 mb-2 font-bold font-mono">
                    <span className="flex items-center space-x-1.5">
                      <Zap className="w-3 h-3 fill-current" />
                      <span>{msg.agentName}</span>
                    </span>
                    <span className="text-slate-500 font-normal">{msg.timestamp}</span>
                  </div>
                )}

                <div className="text-slate-100">
                  {renderMessageContent(msg.content, msg.id)}
                </div>

                {/* Attachments Preview in Message */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                    {msg.attachments.map(att => (
                      <div
                        key={att.id}
                        className="px-2.5 py-1 bg-slate-950/80 border border-slate-700 rounded-lg text-[11px] font-mono text-cyan-300 flex items-center space-x-1.5"
                      >
                        <FileCode className="w-3 h-3" />
                        <span className="truncate max-w-[140px]">{att.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="p-2 sm:p-2.5 bg-slate-800 border border-slate-700 text-cyan-400 rounded-2xl shadow-md shrink-0 mt-0.5">
                  <User className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-blue-600 text-white rounded-2xl shadow-md shrink-0">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl rounded-tl-none p-4 text-xs font-mono text-cyan-400 flex items-center space-x-2.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Aegis is reasoning, generating code files, and syncing with GitHub...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-28 right-6 z-20 p-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-full shadow-xl border border-cyan-300 transition-all cursor-pointer"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Bottom Chat Input Bar */}
      <div className="p-3 sm:p-4 bg-slate-900/90 border-t border-slate-800 backdrop-blur-md">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* File Attachment Badges */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1">
              {attachedFiles.map(f => (
                <div
                  key={f.id}
                  className="px-3 py-1 bg-slate-800 border border-cyan-500/40 rounded-xl text-xs text-cyan-300 flex items-center space-x-2 font-mono shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[160px]">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(f.id)}
                    className="hover:text-rose-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex items-end space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              className="hidden"
            />

            {onOpenMenu && (
              <button
                type="button"
                onClick={onOpenMenu}
                className="p-3 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-400 hover:text-cyan-200 rounded-2xl border border-cyan-500/40 transition-all shrink-0 shadow-md cursor-pointer flex items-center justify-center group"
                title="Quick Menu (History, Tools, GitHub)"
              >
                <Menu className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-slate-700 transition-colors shrink-0 shadow-sm cursor-pointer"
              title="Attach Code / Files"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <div className="flex-1 bg-slate-950 border border-slate-800 focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500/40 rounded-2xl p-2 transition-all">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Ask Aegis AI: 'Add autonomous tool into myself', 'Rewrite codebase', or 'Build new feature'..."
                className="w-full bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none font-sans px-2 py-1 leading-normal max-h-44"
              />
            </div>

            <button
              type="submit"
              disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
              className="p-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-40 shrink-0 cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-2 pt-1">
            <span>💡 Press <strong className="text-slate-400">Ctrl + Enter</strong> or click Send to submit</span>
            <span>Connected: <strong className="text-cyan-400">{repoName}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
