import React, { useState } from 'react';
import { Settings, Bell, Moon, Sun, Globe, Shield, Lock, Check } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export const PersonalSettingsSubView: React.FC = () => {
  const { theme, setTheme, locale, setLocale } = useProject();
  const isRtl = locale === 'fa';

  const [emailNotifs, setEmailNotifs] = useState(true);
  const [inAppNotifs, setInAppNotifs] = useState(true);
  const [workingHours, setWorkingHours] = useState('۰۸:۰۰ - ۱۷:۰۰');

  return (
    <div className="space-y-6 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-600 dark:text-slate-300" />
            <span>تنظیمات شخصی (Personal Settings)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
            شخصی‌سازی ترجیحات کاربری، اعلانات، تم ظاهری و ساعت کاری اختصاصی شما
          </p>
        </div>
      </div>

      {/* SETTINGS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* THEME & LOCALE */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
            تم و زبان رابط کاربری
          </h3>

          <div className="space-y-3 text-xs font-bold">
            <div className="flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-200">حالت تاریک / روشن</span>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${theme === 'light' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-400'}`}
                >
                  <Sun size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${theme === 'dark' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400'}`}
                >
                  <Moon size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-200">زبان سامانه</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLocale('fa')}
                  className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${locale === 'fa' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600'}`}
                >
                  فارسی (RTL)
                </button>
                <button
                  type="button"
                  onClick={() => setLocale('en')}
                  className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${locale === 'en' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600'}`}
                >
                  English (LTR)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* NOTIFICATION PREFERENCES */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
            ترجیحات دریافت اعلانات
          </h3>

          <div className="space-y-3 text-xs font-bold">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-700 dark:text-slate-200">دریافت اعلان درون‌برنامه‌ای</span>
              <input
                type="checkbox"
                checked={inAppNotifs}
                onChange={(e) => setInAppNotifs(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 cursor-pointer">
              <span className="text-slate-700 dark:text-slate-200">ارسال خلاصه فعالیت‌ها به ایمیل</span>
              <input
                type="checkbox"
                checked={emailNotifs}
                onChange={(e) => setEmailNotifs(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
