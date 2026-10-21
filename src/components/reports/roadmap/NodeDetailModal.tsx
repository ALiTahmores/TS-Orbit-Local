import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Upload, 
  User, 
  Calendar, 
  Layers, 
  Sparkles,
  Link,
  Paperclip,
  Check
} from 'lucide-react';
import { RoadmapNode, RoadmapDeliverable } from './roadmapData';

export interface NodeDetailModalProps {
  node: RoadmapNode | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleDeliverable: (nodeId: string, deliverableId: string) => void;
  onMarkNodeComplete: (nodeId: string) => void;
  allNodes: RoadmapNode[];
}

export const NodeDetailModal: React.FC<NodeDetailModalProps> = ({
  node,
  isOpen,
  onClose,
  onToggleDeliverable,
  onMarkNodeComplete,
  allNodes
}) => {
  if (!isOpen || !node || typeof document === 'undefined') return null;

  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const completedCount = node.deliverables.filter(d => d.completed).length;
  const totalCount = node.deliverables.length;
  const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isNodeFinished = node.status === 'completed';

  // Find prerequisite nodes
  const prerequisiteNodes = allNodes.filter(n => node.dependencies.includes(n.id));

  const handleSimulatedFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      setTimeout(() => {
        const newFiles = Array.from(e.target.files || []).map((f: File) => f.name);
        setUploadedFiles(prev => [...prev, ...newFiles]);
        setIsUploading(false);
      }, 500);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-vazirmatn"
      dir="rtl"
    >
      {/* 1. Translucent Blurred Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 z-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in cursor-pointer" 
      />

      {/* 2. Elevated Centered Modal Surface */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-[#0d121f] rounded-[28px] border border-slate-200/90 dark:border-slate-800 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95 duration-150 overflow-hidden text-right">
        
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-5 px-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0f1523] shrink-0">
          
          {/* Right: Phase title & Badges */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-black px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {node.phaseNumber}
              </span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {node.teamName}
              </span>
            </div>

            {/* Status Badge */}
            <div>
              {node.status === 'completed' && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  <CheckCircle2 size={13} />
                  <span>تکمیل‌شده</span>
                </span>
              )}
              {node.status === 'in_progress' && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 animate-pulse">
                  <Sparkles size={13} />
                  <span>درحال اجرا</span>
                </span>
              )}
              {node.status === 'blocked' && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
                  <AlertTriangle size={13} />
                  <span>گلوگاه / متوقف‌شده</span>
                </span>
              )}
              {(!node.status || node.status === 'pending') && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  <Clock size={13} />
                  <span>در انتظار فاز قبل</span>
                </span>
              )}
            </div>
          </div>

          {/* Left: Close Button */}
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="بستن پنجره"
          >
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none">
          
          {/* Phase Title & Description */}
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-snug">
              {node.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              {node.description}
            </p>
          </div>

          {/* Bottleneck Warning Banner if blocked */}
          {node.status === 'blocked' && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3">
              <AlertTriangle className="text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" size={19} />
              <div className="text-xs">
                <p className="font-black text-rose-700 dark:text-rose-300">هشدار انسداد در مسیر بحرانی (Critical Path)</p>
                <p className="text-rose-600 dark:text-rose-400/90 text-xs mt-1 leading-relaxed">
                  {node.bottleneckReason || 'مراحل پیش‌نیاز این فاز با تاخیر مواجه شده یا مستندات کلیدی هنوز آپلود نشده‌اند.'}
                </p>
              </div>
            </div>
          )}

          {/* Responsible Lead & Duration Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs mb-1">
                <User size={14} className="text-blue-500" />
                <span>سرپرست دپارتمان</span>
              </div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{node.teamLead}</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs mb-1">
                <Calendar size={14} className="text-cyan-500" />
                <span>مدت زمان برآوردی</span>
              </div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200">{node.estimatedDays} روز کاری استاندارد</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-400">پیشرفت اقلام قابل‌تحویل این فاز</span>
              <span className="font-mono font-black text-blue-600 dark:text-cyan-400">{percentComplete}٪ ({completedCount} از {totalCount})</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  percentComplete === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                }`}
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          {/* Deliverables Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <ShieldCheck size={16} className="text-blue-500" />
                <span>چک‌لیست اقلام قابل‌تحویل (Deliverables)</span>
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">الزامی برای عبور به فاز بعد</span>
            </div>

            <div className="space-y-2">
              {node.deliverables.map((del) => (
                <label
                  key={del.id}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                    del.completed
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-slate-800 dark:text-slate-200'
                      : 'bg-white dark:bg-slate-900/60 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={del.completed}
                    onChange={() => onToggleDeliverable(node.id, del.id)}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-white dark:bg-slate-950 cursor-pointer w-4 h-4"
                  />
                  <div className="text-xs flex-1">
                    <span className={del.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200 font-bold'}>
                      {del.title}
                    </span>
                    {del.required && (
                      <span className="mr-2 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-500/20">
                        الزامی
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Required Evidence / Attachments */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Paperclip size={16} className="text-cyan-500" />
                <span>مستندات و شواهد الزامی جهت تایید</span>
              </h3>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                {node.evidenceRequired.map((ev, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                    <span>{ev}</span>
                  </li>
                ))}
              </ul>

              {/* File upload simulator */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <label className="flex flex-col items-center justify-center p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500/50 hover:bg-white dark:hover:bg-slate-800/40 transition-all cursor-pointer text-center">
                  <Upload size={18} className="text-slate-400 mb-1" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {isUploading ? 'درحال بارگذاری فایل...' : 'افزودن سند یا تصویر تاییدیه فاز'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">فرمت‌های مجاز: PDF, PNG, JPG, ZIP</span>
                  <input
                    type="file"
                    onChange={handleSimulatedFileUpload}
                    className="hidden"
                    multiple
                  />
                </label>

                {uploadedFiles.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold block">فایل‌های پیوست‌شده:</span>
                    {uploadedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-3 py-1.5 rounded-xl text-slate-800 dark:text-slate-200">
                        <span className="truncate max-w-[280px] font-mono">{file}</span>
                        <CheckCircle2 size={14} className="text-emerald-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Prerequisite dependencies */}
          {prerequisiteNodes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Link size={15} className="text-amber-500" />
                <span>مراحل پیش‌نیاز (Dependencies)</span>
              </h3>
              <div className="space-y-2">
                {prerequisiteNodes.map(pNode => (
                  <div 
                    key={pNode.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                        {pNode.phaseNumber}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 font-bold">{pNode.title}</span>
                    </div>
                    {pNode.status === 'completed' ? (
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    ) : (
                      <Clock size={16} className="text-amber-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Fixed Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0f1523] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer"
          >
            انصراف
          </button>

          <button
            type="button"
            onClick={() => {
              onMarkNodeComplete(node.id);
              onClose();
            }}
            className={`py-2.5 px-5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
              isNodeFinished
                ? 'bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 active:scale-[0.99]'
            }`}
          >
            <CheckCircle2 size={16} />
            <span>
              {isNodeFinished ? 'تکمیل‌شده (کلیک جهت بازگشایی فاز)' : 'علامت‌گذاری به‌عنوان تکمیل‌شده و عبور به فاز بعد'}
            </span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default NodeDetailModal;
