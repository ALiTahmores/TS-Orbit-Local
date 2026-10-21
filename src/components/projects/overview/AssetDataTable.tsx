import {downloadAsset} from '../../../lib/assets';
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  MoreHorizontal, 
  ArrowUpDown, 
  Download, 
  Trash2, 
  Eye, 
  FileText, 
  FileSpreadsheet, 
  Sparkles, 
  FileCode, 
  FileCheck 
} from 'lucide-react';
import { toPersianDigits, getFileExtension, getFileTypeStyle } from './utils';

export interface TableAssetItem {
  id: string;
  name: string;
  category: string; // 'shared' | 'folders' | 'brand' | 'documents' | etc.
  size: string;
  uploadDate: string;
  lastMod: string;
  owners: string[];
  ext?: string;
  version?: number;
  tag?: string;
}

interface AssetDataTableProps {
  assets: TableAssetItem[];
  selectedIds: string[];
  onSelectToggle: (id: string) => void;
  onSelectAllToggle: (checked: boolean) => void;
  filterPill: 'all' | 'shared' | 'folders';
  onFilterPillChange: (pill: 'all' | 'shared' | 'folders') => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onRowClick: (asset: TableAssetItem) => void;
  onDeleteAsset: (id: string) => void;
  layoutMode?: 'grid' | 'list';
}

export const AssetDataTable: React.FC<AssetDataTableProps> = ({
  assets,
  selectedIds,
  onSelectToggle,
  onSelectAllToggle,
  filterPill,
  onFilterPillChange,
  searchQuery,
  onSearchQueryChange,
  onRowClick,
  onDeleteAsset,
  layoutMode = 'list'
}) => {
  const [downloadError,setDownloadError]=useState('');
  const [sortField, setSortField] = useState<'name' | 'date' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeMenuAssetId, setActiveMenuAssetId] = useState<string | null>(null);

  // Filter assets by pill category and search query
  const filteredAssets = useMemo(() => {
    return assets
      .filter((item) => {
        if (filterPill === 'shared') return item.category === 'shared' || item.category === 'content' || item.category === 'brand';
        if (filterPill === 'folders') return item.category === 'folders' || item.category === 'documents' || item.category === 'contracts';
        return true;
      })
      .filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortField === 'name') {
          return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        }
        if (sortField === 'size') {
          return sortOrder === 'asc' ? a.size.localeCompare(b.size) : b.size.localeCompare(a.size);
        }
        return sortOrder === 'asc' ? a.uploadDate.localeCompare(b.uploadDate) : b.uploadDate.localeCompare(a.uploadDate);
      });
  }, [assets, filterPill, searchQuery, sortField, sortOrder]);

  const allSelected = filteredAssets.length > 0 && filteredAssets.every(a => selectedIds.includes(a.id));

  const toggleSort = (field: 'name' | 'date' | 'size') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getFileBadge = (filename: string) => {
    const ext = getFileExtension(filename);
    switch (ext) {
      case 'XLSX':
      case 'CSV':
        return <FileSpreadsheet size={16} className="text-emerald-600 dark:text-emerald-400" />;
      case 'FIG':
      case 'PNG':
      case 'JPG':
        return <Sparkles size={16} className="text-blue-600 dark:text-blue-400" />;
      case 'PDF':
        return <FileCheck size={16} className="text-amber-600 dark:text-amber-400" />;
      case 'SQL':
      case 'TS':
      case 'JS':
        return <FileCode size={16} className="text-cyan-600 dark:text-cyan-400" />;
      default:
        return <FileText size={16} className="text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="space-y-4">{downloadError&&<p role="alert" className="text-red-600">{downloadError}</p>}
      
      {/* Filter Bar Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-50/90 dark:bg-slate-800/50 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-md">
        
        {/* Segmented Pill Selector */}
        <div className="flex items-center bg-slate-200/70 dark:bg-slate-900/80 p-1 rounded-xl shadow-2xs">
          <button
            type="button"
            onClick={() => onFilterPillChange('all')}
            className={`px-4 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              filterPill === 'all'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-black shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-bold'
            }`}
          >
            همه موارد ({toPersianDigits(assets.length)})
          </button>
          <button
            type="button"
            onClick={() => onFilterPillChange('shared')}
            className={`px-4 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              filterPill === 'shared'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-black shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-bold'
            }`}
          >
            اسناد اشتراکی
          </button>
          <button
            type="button"
            onClick={() => onFilterPillChange('folders')}
            className={`px-4 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              filterPill === 'folders'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-black shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-bold'
            }`}
          >
            پوشه‌ها
          </button>
        </div>

        {/* Table Search Input & Sort trigger */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="جستجوی فایل‌ها..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full pr-8 pl-8 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
            <Search size={14} className="absolute right-2.5 top-2.5 text-slate-400" />
          </div>

          <button
            type="button"
            onClick={() => toggleSort('date')}
            className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
            title="مرتب‌سازی"
          >
            <ArrowUpDown size={14} />
            <span className="hidden sm:inline">مرتب‌سازی</span>
          </button>
        </div>

      </div>

      {/* Render Grid Mode or Table Mode */}
      {layoutMode === 'grid' ? (
        filteredAssets.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 font-['Vazirmatn'] [font-feature-settings:'ss01'_1] flex flex-col items-center justify-center space-y-2 col-span-full">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
              لیست اسناد خالی است. برای شروع، اول فایل خود را ایجاد یا آپلود کنید.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAssets.map((row) => {
            const isSelected = selectedIds.includes(row.id);
            const ext = getFileExtension(row.name);
            const style = getFileTypeStyle(row.name, row.category);

            return (
              <div 
                key={row.id}
                className={`bg-white dark:bg-slate-900 border ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-800'
                } p-4 rounded-2xl hover:shadow-lg transition-all relative group cursor-pointer`}
                onClick={() => onRowClick(row)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onSelectToggle(row.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                    />
                    <div className={`p-2.5 rounded-xl ${style.badgeBg} ${style.textColor}`}>
                      {getFileBadge(row.name)}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md ${style.badgeBg} ${style.badgeText} text-[10px] font-black font-mono`}>
                    .{ext}
                  </span>
                </div>

                <div className="mt-3">
                  <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                    {row.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>حجم: {toPersianDigits(row.size)}</span>
                    <span>{toPersianDigits(row.uploadDate)}</span>
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center">
                  <div className="flex items-center -space-x-1.5 rtl:space-x-reverse">
                    {(row.owners || []).map((owner, idx) => (
                      <span 
                        key={idx}
                        className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900"
                        title={owner}
                      >
                        {owner.charAt(0)}
                      </span>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {row.lastMod || 'زمان ویرایش موجود نیست'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )) : (
        /* High-Density Asset Data Table */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-all">
          <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            <table className="w-full text-right border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => onSelectAllToggle(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th 
                    className="p-3.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      <span>نام فایل (File Name)</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-3.5">مالک / ایجادکننده</th>
                  <th 
                    className="p-3.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                    onClick={() => toggleSort('date')}
                  >
                    <div className="flex items-center gap-1">
                      <span>تاریخ آپلود</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-3.5">آخرین تغییرات</th>
                  <th 
                    className="p-3.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                    onClick={() => toggleSort('size')}
                  >
                    <div className="flex items-center gap-1">
                      <span>حجم فایل</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="p-3.5 text-center">اکشن‌ها</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 font-bold font-['Vazirmatn'] [font-feature-settings:'ss01'_1]">
                      لیست اسناد خالی است. برای شروع، اول فایل خود را ایجاد یا آپلود کنید.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((row) => {
                    const isSelected = selectedIds.includes(row.id);
                    const ext = getFileExtension(row.name);
                    const style = getFileTypeStyle(row.name, row.category);

                    return (
                      <tr 
                        key={row.id} 
                        className={`hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group ${
                          isSelected ? 'bg-blue-50/70 dark:bg-blue-950/40' : ''
                        }`}
                        onClick={() => onRowClick(row)}
                      >
                        <td 
                          className="p-3.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onSelectToggle(row.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                          />
                        </td>

                        {/* File Name */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-lg font-bold text-[10px] ${style.badgeBg} ${style.textColor}`}>
                              {ext}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-2">
                                <span>{row.name}</span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${style.badgeBg} ${style.badgeText}`}>
                                  {row.category === 'shared' ? 'اشتراکی' : row.category === 'folders' ? 'پوشه دپارتمان' : row.category}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Owner Avatar Stack */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center -space-x-1.5 rtl:space-x-reverse">
                              {(row.owners || []).map((owner, idx) => (
                                <span 
                                  key={idx} 
                                  className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-2xs"
                                  title={owner}
                                >
                                  {owner.charAt(0)}
                                </span>
                              ))}
                            </div>
                            <span className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                              {(row.owners || []).join('، ')}
                            </span>
                          </div>
                        </td>

                        {/* Date Uploaded */}
                        <td className="p-3.5 text-slate-500 dark:text-slate-400 font-mono font-medium">
                          {toPersianDigits(row.uploadDate)}
                        </td>

                        {/* Last Modified */}
                        <td className="p-3.5 text-slate-600 dark:text-slate-300 font-bold">
                          {row.lastMod || 'زمان ویرایش موجود نیست'}
                        </td>

                        {/* File Size */}
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-[11px]">
                            {toPersianDigits(row.size)}
                          </span>
                        </td>

                        {/* Action Menu */}
                        <td 
                          className="p-3.5 text-center relative"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-block text-right">
                            <button 
                              type="button" 
                              onClick={() => setActiveMenuAssetId(prev => prev === row.id ? null : row.id)}
                              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <MoreHorizontal size={16} />
                            </button>

                            {activeMenuAssetId === row.id && (
                              <div className="absolute left-4 top-10 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-30 py-1 divide-y divide-slate-100 dark:divide-slate-700/60 animate-in fade-in zoom-in-95 duration-150">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuAssetId(null);
                                    onRowClick(row);
                                  }}
                                  className="w-full px-3 py-2 text-right text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <Eye size={14} className="text-blue-500" />
                                  <span>مشاهده جزئیات</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuAssetId(null);
                                    setDownloadError('');void downloadAsset(row).catch(error=>setDownloadError(error.message));
                                  }}
                                  className="w-full px-3 py-2 text-right text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <Download size={14} className="text-emerald-500" />
                                  <span>دانلود مستقیم</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuAssetId(null);
                                    onDeleteAsset(row.id);
                                  }}
                                  className="w-full px-3 py-2 text-right text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-2"
                                >
                                  <Trash2 size={14} />
                                  <span>حذف فایل</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}

              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

