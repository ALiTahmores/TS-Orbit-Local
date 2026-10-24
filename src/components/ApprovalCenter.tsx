import { formatJalaliDateTime } from '../lib/dates';
import { apiFetch } from '../lib/api';
import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { CustomSelect, CustomSelectOption } from './common/CustomSelect';
import { 
  UserCheck, 
  Activity, 
  Lock, 
  ShieldAlert, 
  Smartphone, 
  Laptop, 
  Globe, 
  XCircle, 
  Ban, 
  Clock, 
  Search, 
  FileText, 
  Check, 
  AlertTriangle,
  RefreshCw,
  Monitor,
  Calendar,
  X,
  Plus,
  Trash2,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import StrandsLoader from './loading/StrandsLoader';
import { cn } from '../lib/utils';

export const ApprovalCenter: React.FC = () => {
  const { activeSubTab, setActiveSubTab, currentUser } = useProject();
  
  // Tab states: 'approval_queue' | 'active_sessions' | 'security_audit'
  const currentTab = activeSubTab || 'approval_queue';

  // API states
  const [requests, setRequests] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    blockedCount: 0,
    totalUsersCount: 0,
    onlineUsersCount: 0,
    averageApprovalTime: "6.4 دقیقه",
    autoNotificationQueued: 0,
    autoEmailDispatched: 0
  });

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({ message: '', type: null });

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'BLOCKED'>('ALL');

  // Modal / Active approval states
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // User Governance Modal
  const [showEditGovernanceModal, setShowEditGovernanceModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editRole, setEditRole] = useState('STAFF');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [editDept, setEditDept] = useState('');
  
  // Approval Form fields
  const [approveRole, setApproveRole] = useState('DEVELOPER');
  const [customRole, setCustomRole] = useState('');
  const [approveDept, setApproveDept] = useState('wp_dev');
  const [customDept, setCustomDept] = useState('');
  const [approveTeam, setApproveTeam] = useState('frontend_team');
  const [customTeam, setCustomTeam] = useState('');
  const [approveWorkspace, setApproveWorkspace] = useState('main_workspace');
  const [customWorkspace, setCustomWorkspace] = useState('');
  const [approvePermissions, setApprovePermissions] = useState<string[]>([
    'manage_users', 'manage_projects', 'view_analytics', 'edit_tasks', 'access_financials', 'system_settings'
  ]);
  const [approveDefaultProjectAccess, setApproveDefaultProjectAccess] = useState(true);
  const [approveDefaultChatAccess, setApproveDefaultChatAccess] = useState(true);
  const [approveDefaultModules, setApproveDefaultModules] = useState<string[]>(['projects', 'tasks', 'chat']);
  const [approveNotes, setApproveNotes] = useState('');

  // Reject Form fields
  const [rejectReason, setRejectReason] = useState('');

  // Token helper
  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Fetch all data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch approvals
      const apprRes = await apiFetch('/api/owner/approvals', { headers: getHeaders() });
      if (apprRes.ok) {
        const data = await apprRes.json();
        setRequests(data);
      }

      // 2. Fetch sessions
      const sessRes = await apiFetch('/api/owner/sessions', { headers: getHeaders() });
      if (sessRes.ok) {
        const data = await sessRes.json();
        setSessions(data);
      }

      // 3. Fetch logs
      const auditRes = await apiFetch('/api/owner/audit-logs', { headers: getHeaders() });
      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditLogs(data);
      }

      const loginRes = await apiFetch('/api/owner/login-history', { headers: getHeaders() });
      if (loginRes.ok) {
        const data = await loginRes.json();
        setLoginHistory(data);
      }

      // 4. Fetch stats
      const statsRes = await apiFetch('/api/owner/approval-stats', { headers: getHeaders() });
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error loading administration data:", err);
      showFeedback("خطا در بارگذاری اطلاعات سرور", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.systemRole === 'ADMIN') {
      fetchData();
    }
  }, [currentTab, currentUser]);

  const showFeedback = (msg: string, type: 'success' | 'error' | 'info') => {
    setFeedback({ message: msg, type });
    setTimeout(() => {
      setFeedback({ message: '', type: null });
    }, 5000);
  };

  // Handle Approve request submit
  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/owner/approvals/${selectedRequest.id}/approve`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          role: approveRole,
          reason: approveNotes
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to approve");
      }

      showFeedback(`حساب «${selectedRequest.details.fullName}» فعال شد. برای دسترسی فضای کاری، دعوت جداگانه لازم است.`, 'success');
      setShowApproveModal(false);
      setSelectedRequest(null);
      fetchData();
    } catch (err: any) {
      showFeedback(err.message || "خطا در تایید کاربر", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Reject request submit
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/owner/approvals/${selectedRequest.id}/reject`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason: rejectReason })
      });

      if (!res.ok) {
        throw new Error("Failed to reject");
      }

      showFeedback(`درخواست عضویت کاربر «${selectedRequest.details.fullName}» رد گردید.`, 'info');
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectReason('');
      fetchData();
    } catch (err: any) {
      showFeedback("خطا در رد درخواست کاربر", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Block request
  const handleBlockRequest = async (request: any) => {
    if (!confirm(`آیا از مسدودسازی دائم و قرار دادن کاربر «${request.details.fullName}» در لیست سیاه اطمینان دارید؟`)) return;

    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/owner/approvals/${request.id}/block`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason: "مسدودسازی امنیتی توسط صاحب سیستم" })
      });

      if (!res.ok) {
        throw new Error("Failed to block");
      }

      showFeedback(`حساب کاربری «${request.details.fullName}» مسدود گردید.`, 'error');
      fetchData();
    } catch (err: any) {
      showFeedback("خطا در مسدودسازی کاربر", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Open Edit User Governance Modal
  const handleOpenEditModal = (req: any) => {
    setEditingUser(req);
    setEditRole(req.grantedRole || req.role || 'USER');
    setEditStatus((req.status === 'APPROVED' ? 'ACTIVE' : req.status === 'SUSPENDED' ? 'SUSPENDED' : req.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as any);
    setEditDept(req.grantedDepartment || req.department || '');
    setShowEditGovernanceModal(true);
  };

  // Save User Governance
  const handleSaveUserGovernance = async () => {
    if (!editingUser) return;
    setIsLoading(true);
    try {
      const targetId = editingUser.userId || editingUser.id;
      const res = await apiFetch(`/api/users/${targetId}/governance`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          role: editRole,
          status: editStatus,
          department: editDept
        })
      });
      if (res.ok) {
        showFeedback('تغییرات نقش و وضعیت کاربر با موفقیت بروزرسانی شد.', 'success');
        setShowEditGovernanceModal(false);
        fetchData();
      } else {
        const data = await res.json();
        showFeedback(data.message || 'خطا در ویرایش اطلاعات کاربر', 'error');
      }
    } catch (err) {
      showFeedback('خطای ارتباط با سرور', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Session termination
  const handleTerminateSession = async (session: any) => {
    if (!confirm(`آیا از خاتمه اجباری نشست کاربر «${session.name}» روی سیستم ${session.browser} اطمینان دارید؟`)) return;

    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/owner/sessions/${session.id}/terminate`, {
        method: 'POST',
        headers: getHeaders()
      });

      if (!res.ok) {
        throw new Error("Failed to terminate session");
      }

      showFeedback(`نشست کاربر با موفقیت قطع گردید. کاربر فوراً از سامانه خارج خواهد شد.`, 'success');
      fetchData();
    } catch (err: any) {
      showFeedback("خطا در بستن نشست کاربر", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePermission = (perm: string) => {
    if (approvePermissions.includes(perm)) {
      setApprovePermissions(approvePermissions.filter(p => p !== perm));
    } else {
      setApprovePermissions([...approvePermissions, perm]);
    }
  };

  const toggleModule = (mod: string) => {
    if (approveDefaultModules.includes(mod)) {
      setApproveDefaultModules(approveDefaultModules.filter(m => m !== mod));
    } else {
      setApproveDefaultModules([...approveDefaultModules, mod]);
    }
  };

  // Filters calculation
  const filteredRequests = requests.filter(r => {
    const matchesSearch = 
      r.details.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.details.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.details.phone.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full space-y-6 text-[#1E293B]" id="approval-center-view">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <UserCheck className="text-blue-600" size={24} />
            پنل ممیزی امنیتی و تایید هویت کاربران جدید
          </h1>
          <p className="text-xs text-slate-500 mt-1">مدیریت تایید صلاحیت، دسترسی به دپارتمان‌ها و پایش نشست‌های فعال پرسنل آژانس</p>
        </div>
        <button 
          onClick={fetchData} 
          disabled={isLoading}
          aria-busy={isLoading}
          className="relative overflow-hidden flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 min-w-[130px]"
        >
          <span className={cn('inline-flex items-center justify-center gap-1.5', isLoading ? 'opacity-0 invisible pointer-events-none' : 'opacity-100')}>
            <RefreshCw size={14} />
            <span>بروزرسانی داده‌ها</span>
          </span>
          {isLoading && <StrandsLoader variant="button" />}
        </button>
      </div>

      {/* FEEDBACK SYSTEM */}
      {feedback.message && (
        <div className={`p-4 border rounded-2xl text-xs flex items-center gap-2 animate-bounce ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          feedback.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <AlertTriangle size={16} />
          <p className="font-semibold">{feedback.message}</p>
        </div>
      )}

      {/* Key Stats Widget Block */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">درخواست‌های در انتظار تایید</span>
            <span className="text-lg font-black text-slate-800">{stats.pendingCount || 0} کاربر</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">کل کاربران تایید شده</span>
            <span className="text-lg font-black text-slate-800">{stats.approvedCount || 0} نفر</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Activity size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">کاربران هم‌اکنون آنلاین</span>
            <span className="text-lg font-black text-slate-800">{stats.onlineUsersCount || 0} نشست فعال</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <Lock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 block">سیستم هشدار خودکار</span>
            <span className="text-[11px] font-bold text-rose-700">{stats.autoEmailDispatched || 0} ایمیل و نوتیف ارسال‌شده</span>
          </div>
        </div>

      </div>

      {/* Dynamic Sub Tab Selector */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('approval_queue')}
          className={`px-4 py-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            currentTab === 'approval_queue' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck size={14} />
          <span>صف تایید اعضای جدید</span>
          {stats.pendingCount > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[9px] animate-pulse">
              {stats.pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('active_sessions')}
          className={`px-4 py-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            currentTab === 'active_sessions' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity size={14} />
          <span>پایش دستگاه‌ها و نشست‌های فعال</span>
        </button>

        <button
          onClick={() => setActiveSubTab('security_audit')}
          className={`px-4 py-3 text-xs font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            currentTab === 'security_audit' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lock size={14} />
          <span>لاگ‌های ممیزی سیستم و امنیت</span>
        </button>
      </div>

      {/* --- CONTENT 1: APPROVAL QUEUE --- */}
      {currentTab === 'approval_queue' && (
        <div className="space-y-4">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-3 text-slate-400" size={14} />
              <input 
                type="text"
                placeholder="جستجوی نام، ایمیل، یا تلفن همراه..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 text-xs border border-slate-200 pr-9 pl-3 py-2.5 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400">وضعیت درخواست:</span>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'BLOCKED'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      statusFilter === f 
                        ? 'bg-white text-slate-800 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {f === 'ALL' ? 'همه' : f === 'PENDING' ? 'در انتظار' : f === 'APPROVED' ? 'تایید شده' : f === 'REJECTED' ? 'رد شده' : 'مسدود'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table list */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 border-b border-slate-200 font-bold">
                    <th className="p-4">کاربر ثبت‌نام کننده</th>
                    <th className="p-4">مشخصات تماس</th>
                    <th className="p-4">زمان ثبت درخواست</th>
                    <th className="p-4">جزئیات سیستم و آی‌پی</th>
                    <th className="p-4">وضعیت بررسی</th>
                    <th className="p-4 text-center">عملیات مدیریت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400">
                        <UserCheck size={32} className="mx-auto mb-2 text-slate-300" />
                        <p className="font-bold">درخواست منطبقی در این صف یافت نشد.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-100 text-slate-600 font-bold rounded-xl flex items-center justify-center shadow-inner text-sm">
                              {req.details.fullName.substring(0, 2)}
                            </div>
                            <div>
                              <span className="font-black text-slate-800 block">{req.details.fullName}</span>
                              {req.details.username && <span className="text-[10px] text-slate-400" dir="ltr">@{req.details.username}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="block text-slate-700 font-mono">{req.details.email}</span>
                          <span className="block text-slate-500 font-mono mt-0.5">{req.details.phone}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                            <Calendar size={13} />
                            <span>{req.requestDate}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-[10px] text-slate-500">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-700 font-bold flex items-center gap-1">
                              <Globe size={11} className="text-slate-400" />
                              {req.details.ipAddress} • {req.details.country}
                            </span>
                            <span className="text-slate-400">{req.details.browser} ({req.details.operatingSystem})</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`whitespace-nowrap shrink-0 px-2.5 py-1 text-xs rounded-full font-bold inline-block ${
                            req.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            (req.status === 'APPROVED' || req.status === 'ACTIVE') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            req.status === 'SUSPENDED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            req.status === 'INACTIVE' ? 'bg-slate-100 text-slate-700 border border-slate-300' :
                            req.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            'bg-slate-100 text-slate-600 border border-slate-300'
                          }`}>
                            {req.status === 'PENDING' ? 'در انتظار تایید' : (req.status === 'APPROVED' || req.status === 'ACTIVE') ? 'فعال' : req.status === 'SUSPENDED' ? 'معلق / مسدود' : req.status === 'INACTIVE' ? 'غیرفعال' : req.status === 'REJECTED' ? 'رد شده' : 'مسدود دائم'}
                          </span>
                        </td>
                        <td className="p-4">
                          {req.status === 'PENDING' ? (
                            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                              <button
                                onClick={() => { setSelectedRequest(req); setShowApproveModal(true); }}
                                className="px-3 py-1.5 text-xs font-medium h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                              >
                                <Check size={14} />
                                <span>تایید و تنظیم دسترسی</span>
                              </button>
                              <button
                                onClick={() => { setSelectedRequest(req); setShowRejectModal(true); }}
                                className="px-3 py-1.5 text-xs font-medium h-9 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                              >
                                <XCircle size={14} />
                                <span>رد درخواست</span>
                              </button>
                              <button
                                onClick={() => handleBlockRequest(req)}
                                className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-lg h-9 w-9 flex items-center justify-center transition-all cursor-pointer shrink-0"
                                title="مسدودسازی دائم (لیست سیاه)"
                              >
                                <Ban size={15} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                              <button
                                onClick={() => handleOpenEditModal(req)}
                                className="px-3 py-1.5 text-xs font-medium h-9 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                              >
                                <ShieldCheck size={14} />
                                <span>ویرایش نقش و وضعیت</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- CONTENT 2: ACTIVE SESSIONS MONITOR --- */}
      {currentTab === 'active_sessions' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
            <div>
              <h4 className="text-xs font-black text-amber-800">امنیت دستگاه‌های متصل</h4>
              <p className="text-[11px] text-amber-700 leading-relaxed mt-1">
                صاحب سیستم می‌تواند کلیه کلاینت‌های متصل به کارگاه را پایش کند. در صورت مشاهده هرگونه نشست مشکوک، با کلیک بر روی کلید «قطع اتصال»، توکن کاربری ابطال و کاربر فوراً به صفحه لاگین بازگردانده می‌شود.
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 border-b border-slate-200 font-bold">
                    <th className="p-4">کاربر متصل</th>
                    <th className="p-4">آدرس IP</th>
                    <th className="p-4">سیستم عامل / دستگاه</th>
                    <th className="p-4">مرورگر</th>
                    <th className="p-4">آخرین فعالیت ثبت‌شده</th>
                    <th className="p-4 text-center">مدیریت اتصال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400">
                        <Activity size={32} className="mx-auto mb-2 text-slate-300" />
                        <p className="font-bold">در حال حاضر نشست فعالی ثبت نشده است.</p>
                      </td>
                    </tr>
                  ) : (
                    sessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
                              {sess.name.substring(0, 1)}
                            </div>
                            <div>
                              <span className="font-black text-slate-800 block">{sess.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{sess.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-700">{sess.ipAddress}</td>
                        <td className="p-4 font-mono text-slate-600">
                          <span className="flex items-center gap-1.5 font-sans font-semibold">
                            {sess.device === 'Mobile' ? <Smartphone size={13} /> : <Monitor size={13} />}
                            {sess.operatingSystem} ({sess.device})
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-500">{sess.browser}</td>
                        <td className="p-4 text-slate-600 font-semibold">{formatJalaliDateTime(sess.lastActivity)}</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleTerminateSession(sess)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                          >
                            خاتمه نشست و اخراج
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- CONTENT 3: SECURITY AUDIT LOGS --- */}
      {currentTab === 'security_audit' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Box A: Login History */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <Activity className="text-blue-600" size={16} />
                تاریخچه ورود و احراز هویت پرسنل
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">کلیه ورودهای موفق، تلاش‌های ناموفق و مسدودسازی دسترسی در این بخش لاگ می‌شوند.</p>
            </div>

            <div className="overflow-y-auto max-h-[500px] border border-slate-100 rounded-2xl">
              <div className="divide-y divide-slate-100 text-xs font-semibold">
                {loginHistory.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">تاریخچه‌ای یافت نشد.</div>
                ) : (
                  loginHistory.map((lh) => (
                    <div key={lh.id} className="p-4 flex flex-col gap-2 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700">{lh.email}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          lh.loginResult === 'Successful' ? 'bg-emerald-50 text-emerald-700' :
                          lh.loginResult === 'Blocked' ? 'bg-amber-50 text-amber-700' :
                          'bg-rose-50 text-rose-700'
                        }`}>
                          {lh.loginResult === 'Successful' ? 'موفق' : lh.loginResult === 'Blocked' ? 'مسدود شده' : 'رمز اشتباه'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>زمان: {formatJalaliDateTime(lh.loginTime || lh.loginDate)}</span>
                        <span>IP: {lh.ipAddress}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        مرورگر: {lh.browser} ({lh.operatingSystem}) • {lh.authenticationMethod}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Box B: Audit Logs */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <FileText className="text-blue-600" size={16} />
                دفتر کل ممیزی و تغییرات سیستمی (Audit Logs)
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">ردپای دیجیتالی کلیه تغییرات حساس مدیریتی و اقدامات سیستمی پرسنل.</p>
            </div>

            <div className="overflow-y-auto max-h-[500px] border border-slate-100 rounded-2xl">
              <div className="divide-y divide-slate-100 text-xs font-semibold">
                {auditLogs.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">ردپایی ثبت نشده است.</div>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-mono font-bold">{log.action}</span>
                        <span className="text-[10px] text-slate-400">{formatJalaliDateTime(log.timestamp)}</span>
                      </div>
                      <p className="text-slate-700 text-xs leading-relaxed font-black">{log.details}</p>
                      <div className="text-[10px] text-slate-400 font-mono">کاربر عامل: {log.userId}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      )}


      {/* --- MODAL 1: APPROVE CONFIGURATION MODAL --- */}
      {showApproveModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            onClick={() => { setShowApproveModal(false); setSelectedRequest(null); }}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[28px] border border-slate-200/90 dark:border-slate-800 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            
            <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                  <UserCheck className="text-emerald-600" size={18} />
                  پیکربندی دسترسی‌ها: «{selectedRequest.details.fullName}»
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{selectedRequest.details.email}</p>
              </div>
              <button 
                onClick={() => { setShowApproveModal(false); setSelectedRequest(null); }}
                className="p-1.5 bg-slate-200/60 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleApproveSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              
              <p className="text-xs text-slate-500">تایید حساب و سمت نمایشی مجوز فضای کاری ایجاد نمی‌کند. اعضا و نقش فضای کاری را از دعوت فضای کاری مدیریت کنید.</p>
              <label className="text-xs block">سمت نمایشی حساب</label>
              <CustomSelect options={[{"value":"USER","label":"USER"},{"value":"CLIENT","label":"CLIENT"},{"value":"DEVELOPER","label":"DEVELOPER"},{"value":"PROJECT_MANAGER","label":"PROJECT_MANAGER"},{"value":"SPECIALIST","label":"SPECIALIST"},{"value":"SEO_SPECIALIST","label":"SEO_SPECIALIST"},{"value":"CONTENT_CREATOR","label":"CONTENT_CREATOR"},{"value":"DESIGNER","label":"DESIGNER"},{"value":"QA_ENGINEER","label":"QA_ENGINEER"},{"value":"MEMBER","label":"MEMBER"},{"value":"VIEWER","label":"VIEWER"}]} value={approveRole} onChange={setApproveRole} />
              {/* Notes */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">یادداشت‌های ارزیابی مدیریت (جهت درج در ممیزی)</label>
                <textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed font-medium"
                  placeholder="نکات تکمیلی برای تایید صلاحیت کلاینت..."
                  rows={2}
                />
              </div>

              {/* Buttons */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { setShowApproveModal(false); setSelectedRequest(null); }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  aria-busy={isLoading}
                  className="relative overflow-hidden px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10 disabled:opacity-50 min-w-[190px]"
                >
                  <span className={cn('inline-flex items-center justify-center gap-1.5', isLoading ? 'opacity-0 invisible pointer-events-none' : 'opacity-100')}>
                    <Check size={14} />
                    <span>تایید صلاحیت و فعالسازی کاربر</span>
                  </span>
                  {isLoading && <StrandsLoader variant="button" />}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: REJECT REASON MODAL --- */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            onClick={() => { setShowRejectModal(false); setSelectedRequest(null); }}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 w-full max-w-md rounded-[28px] border border-slate-200/90 dark:border-slate-800 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
            
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                <XCircle className="text-rose-600" size={18} />
                رد درخواست ثبت‌نام کاربر
              </h3>
              <button 
                onClick={() => { setShowRejectModal(false); setSelectedRequest(null); }}
                className="p-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 rounded-full transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                علت رد صلاحیت کاربر <span className="font-black text-slate-700 dark:text-slate-200">«{selectedRequest.details.fullName}»</span> را وارد نمایید. این علت به ایمیل کاربر ارسال خواهد شد:
              </p>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">علت رد درخواست ثبت‌نام</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500 leading-relaxed font-bold"
                  placeholder="مثال: عدم تطابق با هویت پرسنلی آژانس"
                  rows={3}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowRejectModal(false); setSelectedRequest(null); setRejectReason(''); }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  aria-busy={isLoading}
                  className="relative overflow-hidden px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-500/10 disabled:opacity-50 min-w-[160px]"
                >
                  <span className={cn('inline-flex items-center justify-center gap-1.5', isLoading ? 'opacity-0 invisible pointer-events-none' : 'opacity-100')}>
                    <XCircle size={13} />
                    <span>رد درخواست و ارسال ایمیل</span>
                  </span>
                  {isLoading && <StrandsLoader variant="button" />}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* --- MODAL 3: EDIT USER GOVERNANCE MODAL --- */}
      {showEditGovernanceModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            onClick={() => setShowEditGovernanceModal(false)}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] p-6 max-w-lg w-full space-y-5 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">ویرایش مشخصات و سطح دسترسی کاربر</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{editingUser.details?.fullName || editingUser.name || editingUser.email}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEditGovernanceModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-right">
              {/* Role selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نقش و سطح دسترسی کاربری
                </label>
                <CustomSelect
                  options={[
                    { value: 'USER', label: 'کاربر (USER)' },
                    { value: 'MEMBER', label: 'عضو (MEMBER)' },
                    { value: 'PROJECT_MANAGER', label: 'مدیر پروژه (PROJECT_MANAGER)' },
                    { value: 'DEVELOPER', label: 'توسعه‌دهنده (DEVELOPER)' },
                    { value: 'SPECIALIST', label: 'متخصص فنی (SPECIALIST)' },
                    { value: 'CLIENT', label: 'کلاینت / کارفرما (CLIENT)' },
                  ]}
                  value={editRole}
                  onChange={(val) => setEditRole(val)}
                />
              </div>

              {/* Status Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  تغییر وضعیت حساب کاربری
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditStatus('ACTIVE')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editStatus === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    <span>فعال (ACTIVE)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditStatus('INACTIVE')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editStatus === 'INACTIVE'
                        ? 'bg-slate-200 text-slate-800 border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <AlertTriangle size={13} />
                    <span>غیرفعال (INACTIVE)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditStatus('SUSPENDED')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editStatus === 'SUSPENDED'
                        ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Ban size={13} />
                    <span>مسدود (SUSPENDED)</span>
                  </button>
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  دپارتمان سازمانی
                </label>
                <input
                  type="text"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                  placeholder="مثلا: توسعه فرانت‌اند"
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowEditGovernanceModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveUserGovernance}
                disabled={isLoading}
                aria-busy={isLoading}
                className="relative overflow-hidden px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 min-w-[120px]"
              >
                <span className={cn('inline-flex items-center justify-center gap-1.5', isLoading ? 'opacity-0 invisible pointer-events-none' : 'opacity-100')}>
                  <Check size={13} />
                  <span>ذخیره تغییرات</span>
                </span>
                {isLoading && <StrandsLoader variant="button" />}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
