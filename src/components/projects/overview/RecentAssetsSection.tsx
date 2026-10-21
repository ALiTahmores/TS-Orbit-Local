import React from 'react';
import { 
  Clock, 
  FileText, 
  Sparkles, 
  FileSpreadsheet, 
  MoreHorizontal, 
  EyeOff, 
  FileCode, 
  FileCheck 
} from 'lucide-react';
import { toPersianDigits, getFileTypeStyle, getFileExtension } from './utils';

interface RecentAsset {
  id: string;
  name: string;
  size?: string;
  uploadDate?: string;
  lastMod?: string;
  category?: string;
  owners?: string[];
  version?: number;
  tag?: string;
}

interface RecentAssetsSectionProps {
  assets: RecentAsset[];
  onViewDetails: (asset: RecentAsset) => void;
  onMoreOptions?: (asset: RecentAsset, e: React.MouseEvent) => void;
  onCreateFile?: () => void;
}

export const RecentAssetsSection: React.FC<RecentAssetsSectionProps> = ({
  assets,
  onViewDetails,
  onMoreOptions,
  onCreateFile
}) => {
  // Show up to 4 recent assets in the top grid
  const recentDisplayAssets = assets.slice(0, 4);

  const getFileIcon = (ext: string) => {
    switch (ext) {
      case 'XLSX':
      case 'CSV':
        return <FileSpreadsheet size={36} className="text-emerald-600 dark:text-emerald-400" />;
      case 'FIG':
      case 'PNG':
      case 'JPG':
        return <Sparkles size={36} className="text-blue-600 dark:text-blue-400" />;
      case 'PDF':
        return <FileCheck size={36} className="text-amber-600 dark:text-amber-400" />;
      case 'SQL':
      case 'TS':
      case 'JS':
        return <FileCode size={36} className="text-cyan-600 dark:text-cyan-400" />;
      default:
        return <FileText size={36} className="text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Clock size={18} className="text-blue-600 dark:text-blue-400" />
          <span>آخرین ویرایش‌ها و خروجی‌های پروژه</span>
        </h3>
        <span className="text-xs text-slate-500 font-bold font-['Vazirmatn'] [font-feature-settings:'ss01'_1]">
          {toPersianDigits(recentDisplayAssets.length)} فایل اخیراً ویرایش شده
        </span>
      </div>

      {recentDisplayAssets.length === 0 ? (
        <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-200/80 dark:border-slate-800 text-slate-500 font-['Vazirmatn'] [font-feature-settings:'ss01'_1] flex flex-col items-center justify-center space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <FileText size={28} />
          </div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
            هیچ فایل یا پوشه‌ای هنوز ایجاد نشده است
          </p>
          {onCreateFile && (
            <button
              type="button"
              onClick={onCreateFile}
              className="mt-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer font-['Vazirmatn'] [font-feature-settings:'ss01'_1]"
            >
              + آپلود اولین فایل
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
          {recentDisplayAssets.map((asset) => {
            const ext = getFileExtension(asset.name);
            const style = getFileTypeStyle(asset.name, asset.category);

            return (
              <div 
                key={asset.id} 
                className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-3 hover:border-blue-500/50 hover:shadow-xl transition-all duration-300 relative group overflow-hidden rounded-2xl"
              >
                {/* Visual Preview Header Banner */}
                <div className={`h-32 bg-gradient-to-br ${style.bgGradient} rounded-xl flex items-center justify-center relative overflow-hidden border ${style.borderColor}`}>
                  
                  <div className="transition-transform group-hover:scale-110 duration-300">
                    {getFileIcon(ext)}
                  </div>

                  <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md text-[10px] font-black rounded-md ${style.badgeText} border ${style.borderColor} shadow-2xs font-mono`}>
                    .{ext}
                  </span>

                  {/* Hover Action Overlay */}
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button 
                      type="button" 
                      onClick={() => onViewDetails(asset)}
                      className="bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-white px-3.5 py-1.5 rounded-xl text-xs font-black shadow-lg flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    >
                      <EyeOff size={14} className={style.textColor} />
                      <span>مشاهده جزئیات</span>
                    </button>
                  </div>
                </div>

                {/* Card Info Section */}
                <div className="pt-3 px-1 flex justify-between items-start">
                  <div className="flex-1 min-w-0 pr-1">
                    <h4 
                      onClick={() => onViewDetails(asset)}
                      className="font-extrabold text-xs text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate cursor-pointer"
                      title={asset.name}
                    >
                      {asset.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                      <span>ویرایش:</span>
                      <span>{asset.lastMod || asset.uploadDate || 'زمان ثبت موجود نیست'}</span>
                    </p>
                  </div>
                  <button 
                    type="button" 
                    onClick={(e) => onMoreOptions ? onMoreOptions(asset, e) : onViewDetails(asset)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
