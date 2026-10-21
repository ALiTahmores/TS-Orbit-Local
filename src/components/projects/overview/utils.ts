// Utility functions & data mappers for the Overview Tab (Cloudboard design)

export const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

export const getFileExtension = (filename: string): string => {
  if (!filename) return 'DOC';
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts[parts.length - 1].toUpperCase();
  }
  return 'DOC';
};

export interface FileTypeStyle {
  bgGradient: string;
  textColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  iconType: 'figma' | 'doc' | 'excel' | 'pdf' | 'image' | 'code' | 'zip' | 'default';
}

export const getFileTypeStyle = (filename: string, category?: string): FileTypeStyle => {
  const ext = getFileExtension(filename);
  
  if (ext === 'FIG' || ext === 'PNG' || category === 'brand' || category === 'images') {
    return {
      bgGradient: 'from-blue-100/80 to-slate-50/60 dark:from-blue-950/40 dark:to-slate-900/60',
      textColor: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-200/60 dark:border-blue-800/40',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/60',
      badgeText: 'text-blue-700 dark:text-blue-300',
      iconType: ext === 'FIG' ? 'figma' : 'image'
    };
  }

  if (ext === 'XLSX' || ext === 'CSV' || category === 'seo') {
    return {
      bgGradient: 'from-emerald-100/80 to-teal-50/60 dark:from-emerald-950/40 dark:to-slate-900/60',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      borderColor: 'border-emerald-200/60 dark:border-emerald-800/40',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      iconType: 'excel'
    };
  }

  if (ext === 'PDF' || category === 'contracts') {
    return {
      bgGradient: 'from-amber-100/80 to-orange-50/60 dark:from-amber-950/40 dark:to-slate-900/60',
      textColor: 'text-amber-600 dark:text-amber-400',
      borderColor: 'border-amber-200/60 dark:border-amber-800/40',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/60',
      badgeText: 'text-amber-700 dark:text-amber-300',
      iconType: 'pdf'
    };
  }

  if (ext === 'SQL' || ext === 'TS' || ext === 'JS' || category === 'dev') {
    return {
      bgGradient: 'from-cyan-100/80 to-blue-50/60 dark:from-cyan-950/40 dark:to-slate-900/60',
      textColor: 'text-cyan-600 dark:text-cyan-400',
      borderColor: 'border-cyan-200/60 dark:border-cyan-800/40',
      badgeBg: 'bg-cyan-100 dark:bg-cyan-900/60',
      badgeText: 'text-cyan-700 dark:text-cyan-300',
      iconType: 'code'
    };
  }

  if (ext === 'ZIP' || ext === 'RAR') {
    return {
      bgGradient: 'from-slate-100/80 to-slate-50/60 dark:from-slate-900/40 dark:to-slate-900/60',
      textColor: 'text-slate-600 dark:text-slate-400',
      borderColor: 'border-slate-200/60 dark:border-slate-800/40',
      badgeBg: 'bg-slate-100 dark:bg-slate-800/60',
      badgeText: 'text-slate-700 dark:text-slate-300',
      iconType: 'zip'
    };
  }

  // Default Word / Document style
  return {
    bgGradient: 'from-blue-100/80 to-slate-50/60 dark:from-blue-950/40 dark:to-slate-900/60',
    textColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200/60 dark:border-blue-800/40',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/60',
    badgeText: 'text-blue-700 dark:text-blue-300',
    iconType: 'doc'
  };
};

// Current downloadable file bytes. Legacy size labels do not establish real storage usage.
export const calculateStorageFromAssets = (files: any[],quotaBytes?:number): {byteSize:number;unknownCount:number;usedMB:number;usedGB:string;percentage:number|null} => {
  let byteSize=0,unknownCount=0;
  for(const file of files||[]) {
    if(file?.contentAvailable===false||!Number.isSafeInteger(file?.byteSize)||file.byteSize<0){unknownCount++;continue;}
    byteSize+=file.byteSize;
  }
  return {
    byteSize,unknownCount,
    usedMB:Math.round(byteSize/(1024*1024)),
    usedGB:(byteSize/(1024*1024*1024)).toFixed(1),
    percentage:Number.isFinite(quotaBytes)&&quotaBytes>0?Math.min(100,Math.round(byteSize/quotaBytes*100)):null
  };
};
