import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, CheckCircle2, GitCommit, ArrowRight, RefreshCw, X } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgradeNow: () => Promise<void>;
  updateDetails: {
    message: string;
    commitSha: string;
    timestamp: string;
    filesPushed?: string[];
  } | null;
  isUpgrading: boolean;
  repoName: string;
  branchName: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  onUpgradeNow,
  updateDetails,
  isUpgrading,
  repoName,
  branchName
}) => {
  if (!isOpen || !updateDetails) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-cyan-500/10 relative overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute -top-20 -right-20 w-44 h-44 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start space-x-4 mb-5">
            <div className="p-3 bg-cyan-500/15 border border-cyan-500/40 rounded-2xl text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/20">
              <Zap className="w-6 h-6 fill-current animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Autonomous Upgrade Ready
              </span>
              <h3 className="text-xl font-bold text-white mt-1">
                New System Capability Engineered
              </h3>
            </div>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 mb-5">
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
              <GitCommit className="w-4 h-4 text-cyan-400" />
              <span>Target Repo: <strong className="text-white">{repoName}</strong> ({branchName})</span>
            </div>
            <p className="text-sm font-sans text-slate-200 leading-relaxed font-medium">
              {updateDetails.message}
            </p>
            {updateDetails.filesPushed && updateDetails.filesPushed.length > 0 && (
              <div className="text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                <span className="text-cyan-400 font-bold block mb-1">Created & Pushed Code Files:</span>
                <div className="flex flex-wrap gap-1.5">
                  {updateDetails.filesPushed.map((f, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded-md text-[11px] text-cyan-300">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Later
            </button>
            <button
              onClick={onUpgradeNow}
              disabled={isUpgrading}
              className="flex-[2] py-3 px-5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {isUpgrading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Upgrading AI Runtime...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Upgrade Now & Apply Changes</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
