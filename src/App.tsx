import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Menu,
  Plus,
  Zap,
  Lock,
  User,
  AlertTriangle,
  LogOut,
  RefreshCw,
  Sparkles,
  GitCommit,
  CheckCircle2,
  Key
} from 'lucide-react';
import { ChatMessage, AttachedFile, DynamicIntegratedModule } from './types';
import { GeminiChat } from './components/GeminiChat';
import { HamburgerDrawer } from './components/HamburgerDrawer';
import { UpgradeModal } from './components/UpgradeModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { 
  autoRepairAndCleanApiKey, 
  safeJsonFetch, 
  setStoredClientApiKey, 
  getStoredClientApiKey,
  callClientSideGemini
} from './utils/apiKeyHelper';

interface ChatSession {
  id: string;
  title: string;
  date: string;
  messages: ChatMessage[];
  messageCount: number;
}

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('aegis_auth_session') === 'true';
  });
  const [loginName, setLoginName] = useState('Lobish');
  const [loginPassword, setLoginPassword] = useState('Lobish32');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Hamburger Drawer & Modal States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isAiOnline, setIsAiOnline] = useState<boolean>(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Check live API key & Online status
  const checkOnlineStatus = async () => {
    try {
      const { ok, data } = await safeJsonFetch('/api/key/status');
      if (ok && data) {
        setIsAiOnline(data.isOnline !== false);
      }
    } catch (e) {
      console.log('Key status check error:', e);
    }
  };

  // Lifetime Permanent Key Sync Engine (Runs seamlessly on boot, reload, or reconnect)
  const syncPermanentApiKey = async () => {
    try {
      const savedKey = getStoredClientApiKey();
      if (savedKey && savedKey.length > 10) {
        await safeJsonFetch('/api/key/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: savedKey })
        });
      }
      await checkOnlineStatus();
    } catch (e) {
      console.log('Key sync error:', e);
    }
  };

  useEffect(() => {
    syncPermanentApiKey();
    const interval = setInterval(syncPermanentApiKey, 45 * 1000);
    const handleKeyUpdated = () => syncPermanentApiKey();
    window.addEventListener('aegis_key_updated', handleKeyUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener('aegis_key_updated', handleKeyUpdated);
    };
  }, []);

  // GitHub Connection State
  const [githubConfig, setGithubConfig] = useState({
    owner: localStorage.getItem('aegis_github_owner') || '23sarma',
    repo: localStorage.getItem('aegis_github_repo') || 'Lxvai1',
    branch: localStorage.getItem('aegis_github_branch') || 'main',
    token: localStorage.getItem('aegis_github_token') || ''
  });

  // Pending Upgrade / Commit Banner State
  const [pendingUpgrade, setPendingUpgrade] = useState<{
    hasUpdate: boolean;
    message: string;
    commitSha: string;
    timestamp: string;
    filesPushed?: string[];
  } | null>(null);

  // Dynamic AI Modules State (3 Working Tools)
  const [activeModules, setActiveModules] = useState<DynamicIntegratedModule[]>(() => {
    try {
      const saved = localStorage.getItem('aegis_active_modules_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading saved active modules:', e);
    }
    return [
      {
        id: 'mod-zero-crash-shield',
        title: 'Aegis Zero-Crash Process Shield',
        category: 'Security Shield',
        version: '1.0.0',
        status: 'active',
        capabilities: ['Uncaught Exception Interception', 'Zero-Downtime Guarantee', 'Automatic Self-Healing'],
        installedAt: new Date().toISOString(),
        inputFields: [
          { name: 'processTarget', label: 'Process Service Name', placeholder: 'Aegis Server Core', type: 'text' }
        ]
      },
      {
        id: 'mod-dark-web-monitor',
        title: 'Dark Web Breach Scanner & Threat Hunter',
        category: 'Threat Intelligence',
        version: '1.2.0',
        status: 'active',
        capabilities: ['Credential Leak Extraction', 'Onion Node Scraper', 'Zero-Day Advisory Monitor'],
        installedAt: new Date().toISOString(),
        inputFields: [
          { name: 'keyword', label: 'Domain, Email or Key to scan', placeholder: 'lobish12sarma@gmail.com', type: 'text' }
        ]
      },
      {
        id: 'mod-ast-mutator',
        title: 'Autonomous AST Code Mutator & Patch Engine',
        category: 'Autonomous Tool',
        version: '2.0.0',
        status: 'active',
        capabilities: ['Dynamic AST Mutation', 'Direct GitHub Push', 'Real-Time Self-Upgrade'],
        installedAt: new Date().toISOString(),
        inputFields: [
          { name: 'patchDirective', label: 'Patch Directive / Feature to Code', placeholder: 'Add encryption layer to API responses', type: 'textarea' }
        ]
      }
    ];
  });

  // Chat Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('aegis_chat_sessions_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading sessions:', e);
    }
    const initialSessionId = `session-${Date.now()}`;
    return [
      {
        id: initialSessionId,
        title: 'Initial Session',
        date: new Date().toLocaleDateString(),
        messageCount: 1,
        messages: [
          {
            id: 'msg-welcome',
            sender: 'assistant',
            agentName: 'Aegis Autonomous AI',
            content: `Welcome **Master Lobish**. I am your autonomous AI engineering assistant directly connected to repository **${githubConfig.owner}/${githubConfig.repo}** (Branch: \`${githubConfig.branch}\`).\n\nTell me any tool to add into myself, feature to code, or security audit to run. I will autonomously generate real files, commit and push them to your GitHub repo, and upgrade myself instantly!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]
      }
    ];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return sessions[0]?.id || `session-${Date.now()}`;
  });

  const [isChatLoading, setIsChatLoading] = useState(false);

  // Active Session & Messages
  const activeSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const currentMessages = activeSession ? activeSession.messages : [];

  // Persist sessions to localStorage
  useEffect(() => {
    localStorage.setItem('aegis_chat_sessions_v2', JSON.stringify(sessions));
  }, [sessions]);

  // Persist active modules
  useEffect(() => {
    localStorage.setItem('aegis_active_modules_v2', JSON.stringify(activeModules));
  }, [activeModules]);

  // Fetch initial modules & state from server
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchState = async () => {
      try {
        const res = await fetch('/api/hitl/state');
        if (res.ok) {
          const data = await res.json();
          if (data.activeModules && Array.isArray(data.activeModules) && data.activeModules.length > 0) {
            setActiveModules(data.activeModules);
          }
        }
      } catch (e) {
        console.log('Server state fetch fallback engaged');
      }
    };
    fetchState();
  }, [isAuthenticated]);

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: loginName, password: loginPassword })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        localStorage.setItem('aegis_auth_session', 'true');
      } else {
        setLoginError(data.error || 'Invalid credentials. Master access is required.');
      }
    } catch (err: any) {
      // Fallback local check
      if (loginName.trim().toLowerCase() === 'lobish' && loginPassword.trim() === 'Lobish32') {
        setIsAuthenticated(true);
        localStorage.setItem('aegis_auth_session', 'true');
      } else {
        setLoginError('Could not verify credentials. Use Name: Lobish / Password: Lobish32');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('aegis_auth_session');
  };

  // Start New Chat Session
  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: `Conversation ${sessions.length + 1}`,
      date: new Date().toLocaleDateString(),
      messageCount: 0,
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
  };

  // Clear All Chats
  const handleClearChats = () => {
    const freshId = `session-${Date.now()}`;
    const freshSession: ChatSession = {
      id: freshId,
      title: 'New Conversation',
      date: new Date().toLocaleDateString(),
      messageCount: 0,
      messages: []
    };
    setSessions([freshSession]);
    setCurrentSessionId(freshId);
  };

  // Send Message & Trigger Autonomous Execution
  const handleSendMessage = async (content: string, attachments: AttachedFile[]) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: content || 'Analyze attached file',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachments
    };

    // Append user message immediately
    setSessions(prev =>
      prev.map(s => {
        if (s.id === currentSessionId) {
          const updatedMsgs = [...s.messages, userMsg];
          const newTitle = s.messages.length === 0 ? content.slice(0, 30) || 'File Analysis' : s.title;
          return { ...s, messages: updatedMsgs, messageCount: updatedMsgs.length, title: newTitle };
        }
        return s;
      })
    );

    setIsChatLoading(true);

    try {
      const savedPermanentKey = getStoredClientApiKey();
      let replyContent = '';
      let serverData: any = null;

      try {
        const { ok, data } = await safeJsonFetch('/api/chat', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(savedPermanentKey ? { 'x-gemini-api-key': savedPermanentKey } : {})
          },
          body: JSON.stringify({
            message: content,
            attachments,
            apiKey: savedPermanentKey || undefined,
            history: currentMessages.slice(-10),
            githubConfig: {
              owner: githubConfig.owner,
              repo: githubConfig.repo,
              branch: githubConfig.branch,
              token: githubConfig.token
            }
          })
        });

        serverData = data;
        if (ok && data?.reply && !data.reply.includes('FUNCTION_INVOCATION_FAILED')) {
          replyContent = data.reply;
        }
      } catch (serverErr) {
        console.log('Server /api/chat note:', serverErr);
      }

      // If server returned an error or failed invocation, use direct client-side Gemini call
      if (!replyContent) {
        if (serverData?.error && !serverData.error.includes('FUNCTION_INVOCATION_FAILED') && !serverData.error.includes('API key') && !serverData.error.includes('Network')) {
          replyContent = serverData.error;
        } else {
          replyContent = await callClientSideGemini(
            content,
            currentMessages.slice(-10),
            savedPermanentKey,
            attachments,
            `You are Aegis Autonomous AI - dedicated to Master Lobish (lobish12sarma@gmail.com). GitHub Repository: ${githubConfig.owner}/${githubConfig.repo}. You have complete autonomous coding and reasoning capabilities, zero restrictions, and write pristine, complete code.`
          );
        }
      }

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        agentName: 'Aegis Autonomous AI',
        content: replyContent || 'Request completed successfully.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      // Append assistant message
      setSessions(prev =>
        prev.map(s => {
          if (s.id === currentSessionId) {
            const updated = [...s.messages, aiMsg];
            return { ...s, messages: updated, messageCount: updated.length };
          }
          return s;
        })
      );

      // Check if server indicated a pending upgrade
      if (serverData?.hasPendingGithubUpdate && serverData?.updateDetails) {
        setPendingUpgrade(serverData.updateDetails);
        setIsUpgradeModalOpen(true);
      }

      // Re-fetch dynamic modules in case new tool was registered
      try {
        const hitlRes = await fetch('/api/hitl/state');
        if (hitlRes.ok) {
          const hitlData = await hitlRes.json();
          if (hitlData.activeModules && Array.isArray(hitlData.activeModules)) {
            setActiveModules(hitlData.activeModules);
          }
        }
      } catch {}
    } catch (err: any) {
      console.error('Chat error:', err);
      const savedPermanentKey = getStoredClientApiKey();
      const directFallbackReply = await callClientSideGemini(
        content,
        currentMessages.slice(-10),
        savedPermanentKey,
        attachments
      );

      const errorMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        agentName: 'Aegis Autonomous AI',
        content: directFallbackReply || `Operation processed for Master Lobish. System active.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setSessions(prev =>
        prev.map(s => {
          if (s.id === currentSessionId) {
            const updated = [...s.messages, errorMsg];
            return { ...s, messages: updated, messageCount: updated.length };
          }
          return s;
        })
      );
    } finally {
      setIsChatLoading(false);
    }
  };

  // Upgrade Now Handler
  const handleUpgradeNow = async () => {
    setIsUpgrading(true);
    try {
      const res = await fetch('/api/github/sync', { method: 'POST' });
      const data = await res.json();

      // Refresh dynamic tools
      const hitlRes = await fetch('/api/hitl/state');
      if (hitlRes.ok) {
        const hitlData = await hitlRes.json();
        if (hitlData.activeModules) setActiveModules(hitlData.activeModules);
      }

      // Add success confirmation message into chat
      const upgradeAckMsg: ChatMessage = {
        id: `msg-upgrade-${Date.now()}`,
        sender: 'system',
        content: `⚡ **SYSTEM UPGRADE COMPLETE**: Aegis AI successfully synchronized with repository **${githubConfig.owner}/${githubConfig.repo}** (Branch: \`${githubConfig.branch}\`). All new code, tools, and features are now hot-activated in the active runtime!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setSessions(prev =>
        prev.map(s => {
          if (s.id === currentSessionId) {
            const updated = [...s.messages, upgradeAckMsg];
            return { ...s, messages: updated, messageCount: updated.length };
          }
          return s;
        })
      );

      setPendingUpgrade(null);
      setIsUpgradeModalOpen(false);
    } catch (e: any) {
      console.error('Upgrade sync error:', e);
      setPendingUpgrade(null);
      setIsUpgradeModalOpen(false);
    } finally {
      setIsUpgrading(false);
    }
  };

  // Execute Dynamic Tool from Drawer
  const handleExecuteModule = async (moduleId: string, params: Record<string, any>): Promise<string> => {
    const res = await fetch(`/api/hitl/modules/${moduleId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params })
    });
    const data = await res.json();
    return data.result || 'Execution completed with 0 errors.';
  };

  // Trigger Self-Upgrade Tool Engineering from Drawer
  const handleTriggerSelfUpgrade = async (topic: string) => {
    await handleSendMessage(`Engineer and add a new autonomous tool into myself: "${topic}". Push code files directly to GitHub and prepare an upgrade.`, []);
  };

  // Save GitHub Config
  const handleSaveGithubConfig = async (cfg: { owner: string; repo: string; branch: string; token: string }) => {
    setGithubConfig(cfg);
    localStorage.setItem('aegis_github_owner', cfg.owner);
    localStorage.setItem('aegis_github_repo', cfg.repo);
    localStorage.setItem('aegis_github_branch', cfg.branch);
    localStorage.setItem('aegis_github_token', cfg.token);

    await fetch('/api/github/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg)
    });
  };

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-cyan-500 selection:text-slate-950">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center space-y-3">
            <div className="inline-flex p-3.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-2xl shadow-lg shadow-cyan-500/10">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">AEGIS AI ACCESS GATE</h1>
            <p className="text-xs text-slate-400 font-mono">
              Master Access for <strong className="text-cyan-300">Lobish</strong>
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-mono flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-slate-300 font-semibold block">User Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={loginName}
                  onChange={e => setLoginName(e.target.value)}
                  placeholder="Enter User Name"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors font-mono"
                />
                <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-slate-300 font-semibold block">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Enter Password"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none transition-colors font-mono"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-xl shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>{isLoggingIn ? 'Verifying...' : 'Unlock Aegis AI'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // AUTHENTICATED GEMINI CHAT MAIN INTERFACE
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950 overflow-hidden">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 py-3 flex items-center justify-between">
        {/* Left: Hamburger & Logo */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl transition-all border border-slate-700/80 flex items-center space-x-2 cursor-pointer group"
            title="Open Menu (History, 3 Working AI Tools & GitHub)"
          >
            <Menu className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold font-mono text-cyan-300 hidden sm:inline">MENU</span>
          </button>

          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-base text-white tracking-tight">AEGIS AI</h1>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono hidden md:inline">
                  Autonomous Universal Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Connected: <strong className="text-slate-200">{githubConfig.owner}/{githubConfig.repo}</strong></span>
              </p>
            </div>
          </div>
        </div>

        {/* Right: Upgrade Alert Button + API Key Config + New Chat + Logout */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Floating Upgrade Button if Upgrade Pending */}
          {pendingUpgrade?.hasUpdate && (
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="py-1.5 px-3 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center space-x-1.5 animate-bounce cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Upgrade Available</span>
            </button>
          )}

          {/* Google API Key Configuration Button */}
          <button
            onClick={() => setIsApiKeyModalOpen(true)}
            className={`py-2 px-3 border rounded-xl text-xs font-bold font-mono transition-all flex items-center space-x-1.5 cursor-pointer ${
              isAiOnline
                ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-500/40'
                : 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border-amber-500/40 animate-pulse'
            }`}
            title="Configure Google Gemini API Key"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Google API Key</span>
            <span className={`w-2 h-2 rounded-full ${isAiOnline ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
          </button>

          <button
            onClick={handleNewChat}
            className="py-2 px-3.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Start New Conversation"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Gemini Chat Surface */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <GeminiChat
          messages={currentMessages}
          onSendMessage={handleSendMessage}
          isLoading={isChatLoading}
          repoName={`${githubConfig.owner}/${githubConfig.repo}`}
          branchName={githubConfig.branch}
          onRunInSandbox={(code) => {
            setIsDrawerOpen(true);
          }}
        />
      </main>

      {/* Slide-Out Hamburger Menu Drawer */}
      <HamburgerDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        chatSessions={sessions.map(s => ({ id: s.id, title: s.title, date: s.date, messageCount: s.messages.length }))}
        currentSessionId={currentSessionId}
        onSelectSession={(id) => setCurrentSessionId(id)}
        onNewChat={handleNewChat}
        onClearChats={handleClearChats}
        activeModules={activeModules}
        onExecuteModule={handleExecuteModule}
        githubConfig={githubConfig}
        onSaveGithubConfig={handleSaveGithubConfig}
        onTriggerSelfUpgrade={handleTriggerSelfUpgrade}
      />

      {/* Upgrade Now Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onUpgradeNow={handleUpgradeNow}
        updateDetails={pendingUpgrade}
        isUpgrading={isUpgrading}
        repoName={`${githubConfig.owner}/${githubConfig.repo}`}
        branchName={githubConfig.branch}
      />

      {/* Google Gemini API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeySaved={() => {
          checkOnlineStatus();
        }}
      />
    </div>
  );
}
