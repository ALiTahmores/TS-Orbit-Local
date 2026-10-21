import { apiFetch, clearCredential } from '../../lib/api';
import { LocalImage } from '../common/LocalImage';
import React, { useState, useMemo, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Building,
  Building2,
  Calendar as CalendarIcon,
  Award,
  CheckCircle2,
  Briefcase,
  Code,
  FileText,
  Camera,
  Upload,
  Download,
  Eye,
  Plus,
  X,
  Lock,
  ShieldCheck,
  DollarSign,
  Clock,
  Sparkles,
  MessageSquare,
  Send,
  ChevronLeft,
  ChevronRight,
  Bell,
  MapPin,
  TrendingUp,
  Check,
  AlertCircle,
  HelpCircle,
  Users,
  GitBranch,
  Star,
  Target,
  FileCheck,
  ArrowRight,
  Layers,
  BarChart3,
  Edit3,
  Bookmark,
  Zap,
  Compass,
  Flag,
  KeyRound,
  Copy,
  CheckCheck,
  RefreshCw,
  Share2,
  Link as LinkIcon,
  Shield
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

const toPersianDigits = (n: string | number | undefined | null): string => {
  if (n === undefined || n === null) return '۰';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

export const ProfileResumeSubView: React.FC = () => {
  const {
    teamMembers,
    projects,
    addNotification,
    locale,
    currentUser,
    activeWorkspaceId
  } = useProject();

  const isRtl = locale === 'fa';
  const isOwnerAccount = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN';

  // Active Main Tab State
  const [activeTabMode, setActiveTabMode] = useState<'resume' | 'orgChart' | 'talentReview'>('resume');

  // User Profile Basic Data (Populated strictly from basic registration fields)
  const [profileData, setProfileData] = useState({
    name: currentUser?.name || (isRtl ? 'کاربر محلی' : 'Local user'),
    role: currentUser?.role || 'OWNER / مدیر ارشد سیستم',
    jobTitle: currentUser?.roleTitle || (isRtl ? 'مدیر ارشد معماری سیستم' : 'Sr. System Architect'),
    department: currentUser?.department || (isRtl ? 'محصول و داده' : 'Product & Data'),
    hourlyRate: '—',
    avatar: currentUser?.avatar || '/avatars/avatar-4.svg',
    username: currentUser?.email?.split('@')[0] || '',
    accessRole: currentUser?.role || 'OWNER / مدیر ارشد سیستم',
    financialReward: '—',
    startDate: '—',
    xpScore: 8450,
    maxXp: 10000,
    level: 3,
    phone: currentUser?.phone || '',
    email: currentUser?.email || '',
    location: '',
    region: '',
    bio: currentUser?.bio || ''
  });

  // Personal history is supplied by the user; do not publish or seed a named resume.
  const sampleExperiences: any[] = [];
  const sampleEducations: any[] = [];
  const sampleSkills: string[] = [];
  const sampleCertifications: any[] = [];
  const sampleEvaluations: any[] = [];
  const sampleSuccessors: any[] = [];

  // Initialize with empty arrays for non-owner or newly registered accounts
  const [experiences, setExperiences] = useState<any[]>(() => isOwnerAccount ? sampleExperiences : []);
  const [educations, setEducations] = useState<any[]>(() => isOwnerAccount ? sampleEducations : []);
  const [skills, setSkills] = useState<string[]>(() => isOwnerAccount ? sampleSkills : []);
  const [certifications, setCertifications] = useState<any[]>(() => isOwnerAccount ? sampleCertifications : []);
  const [evaluations, setEvaluations] = useState<any[]>(() => isOwnerAccount ? sampleEvaluations : []);
  const [successors, setSuccessors] = useState<any[]>(() => isOwnerAccount ? sampleSuccessors : []);

  const [newSkillInput, setNewSkillInput] = useState('');

  // Dynamic Profile Completion Checklist computed from actual collection state
  const completionChecklist = useMemo(() => [
    { id: 'c1', label: 'سوابق کاری (Experiences)', completed: experiences.length > 0, points: 25 },
    { id: 'c2', label: 'تحصیلات (Educations)', completed: educations.length > 0, points: 20 },
    { id: 'c3', label: 'مهارت‌ها و تخصص‌ها (Skills)', completed: skills.length > 0, points: 20 },
    { id: 'c4', label: 'گواهینامه‌ها (Certifications)', completed: certifications.length > 0, points: 15 },
    { id: 'c5', label: 'ارزیابی‌ها و بازخوردها (Talent Reviews)', completed: evaluations.length > 0, points: 20 },
  ], [experiences.length, educations.length, skills.length, certifications.length, evaluations.length]);

  // Calculate completion percentage
  const completionPercentage = useMemo(() => {
    return completionChecklist.filter(item => item.completed).reduce((acc, curr) => acc + curr.points, 0);
  }, [completionChecklist]);

  // Absences Data
  const [absenceMeters] = useState({
    daysOffRemaining: 12,
    daysOffTotal: 15,
    vacationRemaining: 18,
    vacationTotal: 24
  });

  // Modals visibility
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [showAddExperienceModal, setShowAddExperienceModal] = useState(false);
  const [showAddEducationModal, setShowAddEducationModal] = useState(false);
  const [showAddCertificationModal, setShowAddCertificationModal] = useState(false);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [showAddSuccessorModal, setShowAddSuccessorModal] = useState(false);

  // Experience Form
  const [expForm, setExpForm] = useState({
    title: '',
    company: '',
    period: '',
    location: '',
    description: '',
    levelBadge: 'سطح شغلی: Level 2',
    teamManaged: 'تیم تحت مدیریت: ۵ نفر'
  });

  // Education Form
  const [eduForm, setEduForm] = useState({
    degree: '',
    university: '',
    period: '',
    grade: '',
    details: ''
  });

  // Certification Form
  const [certForm, setCertForm] = useState({
    title: '',
    issuer: '',
    date: '',
    type: 'pdf'
  });

  // Review / Evaluation Form (Matching 'Write Review' Card in cd33edf4a662dc0c8fa1f3610726216b.jpg)
  const [reviewForm, setReviewForm] = useState({
    evaluator: currentUser?.name ? `${currentUser.name} (مدیر ارشد)` : 'Devon Lane (مدیر ارشد پروژه‌ها)',
    date: 'مرداد ۱۴۰۳',
    rating: '۵ از ۵ (ممتاز)',
    statusBadge: 'High Potential / Core Star',
    tags: 'استراتژی فنی, رهبری تیم, کیفیت کد',
    notes: ''
  });

  // Successor Form
  const [sucForm, setSucForm] = useState({
    name: '',
    role: '',
    readiness: 'آماده برای ارتقا (۶ ماه آینده)',
    matchScore: '۸۰٪'
  });

  // Password Modal
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirmPass: '' });
  const [passwordToast, setPasswordToast] = useState('');

  // Absence Modal
  const [absenceForm, setAbsenceForm] = useState({
    type: 'مرخصی استحقاقی (Vacation)',
    startDate: '—',
    endDate: '۱۴۰۳/۰۲/۱۷',
    reason: ''
  });

  // Skill Add / Remove
  const handleAddSkill = () => {
    if (!newSkillInput.trim()) return;
    if (!skills.includes(newSkillInput.trim())) {
      setSkills([...skills, newSkillInput.trim()]);
      addNotification({
        title: isRtl ? 'مهارت جدید اضافه شد' : 'Skill Added',
        message: `${newSkillInput.trim()} ${isRtl ? 'به لیست مهارتهای شما افزود شد.' : 'added to your skills.'}`,
        type: 'success'
      });
    }
    setNewSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  // Add Experience Handler
  const handleAddExperienceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expForm.title || !expForm.company) return;

    const newExp = {
      id: `exp-${Date.now()}`,
      title: expForm.title,
      company: expForm.company,
      period: expForm.period || '۱۴۰۳ - تاکنون',
      location: expForm.location || 'تهران، ایران',
      description: expForm.description || 'توضیحات سابقه کاری ثبت‌شده.',
      levelBadge: expForm.levelBadge,
      teamManaged: expForm.teamManaged,
      logo: '/avatars/avatar-0.svg'
    };

    setExperiences([newExp, ...experiences]);
    setShowAddExperienceModal(false);
    setExpForm({
      title: '',
      company: '',
      period: '',
      location: '',
      description: '',
      levelBadge: 'سطح شغلی: Level 2',
      teamManaged: 'تیم تحت مدیریت: ۵ نفر'
    });

    addNotification({
      title: isRtl ? 'سابقه کاری جدید افزود شد' : 'Experience Added',
      message: `${newExp.title} ${isRtl ? 'به سوابق شغلی شما افزوده شد.' : 'added to experiences.'}`,
      type: 'success'
    });
  };

  // Add Education Handler
  const handleAddEducationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eduForm.degree || !eduForm.university) return;

    const newEdu = {
      id: `edu-${Date.now()}`,
      degree: eduForm.degree,
      university: eduForm.university,
      period: eduForm.period || '۱۴۰۰ - ۱۴۰۲',
      grade: eduForm.grade || 'معدل: عالی',
      details: eduForm.details || 'جزئیات مدرک تحصیلی ثبت‌شده.'
    };

    setEducations([...educations, newEdu]);
    setShowAddEducationModal(false);
    setEduForm({
      degree: '',
      university: '',
      period: '',
      grade: '',
      details: ''
    });

    addNotification({
      title: isRtl ? 'مدرک تحصیلی جدید افزود شد' : 'Education Added',
      message: `${newEdu.degree} ${isRtl ? 'ثبت گردید.' : 'added to educations.'}`,
      type: 'success'
    });
  };

  // Add Certification Handler
  const handleAddCertificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!certForm.title || !certForm.issuer) return;

    const newCert = {
      id: `cert-${Date.now()}`,
      title: certForm.title,
      issuer: certForm.issuer,
      date: certForm.date || '۲۰۲۴',
      type: certForm.type || 'pdf'
    };

    setCertifications([...certifications, newCert]);
    setShowAddCertificationModal(false);
    setCertForm({ title: '', issuer: '', date: '', type: 'pdf' });

    addNotification({
      title: isRtl ? 'گواهی‌نامه جدید ثبت شد' : 'Certification Added',
      message: `${newCert.title} ${isRtl ? 'به گواهی‌نامه‌ها افزوده شد.' : 'added to certifications.'}`,
      type: 'success'
    });
  };

  // Add Talent Review / Managerial Evaluation Handler (Write Review)
  const handleAddReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm.notes) return;

    const parsedTags = reviewForm.tags
      ? reviewForm.tags.split(',').map(t => t.trim()).filter(Boolean)
      : ['ارزیابی جدید'];

    const newEv = {
      id: `ev-${Date.now()}`,
      date: reviewForm.date || 'مرداد ۱۴۰۳',
      evaluator: reviewForm.evaluator || 'مدیریت ارشد',
      notes: reviewForm.notes,
      rating: reviewForm.rating || '۵ از ۵ (ممتاز)',
      statusBadge: reviewForm.statusBadge || 'High Potential / Core Star',
      tags: parsedTags
    };

    setEvaluations([newEv, ...evaluations]);
    setShowAddReviewModal(false);
    setReviewForm({
      evaluator: currentUser?.name ? `${currentUser.name} (مدیر ارشد)` : 'Devon Lane (مدیر ارشد پروژه‌ها)',
      date: 'مرداد ۱۴۰۳',
      rating: '۵ از ۵ (ممتاز)',
      statusBadge: 'High Potential / Core Star',
      tags: 'استراتژی فنی, رهبری تیم, کیفیت کد',
      notes: ''
    });

    addNotification({
      title: isRtl ? 'ارزیابی و بازخورد جدید ثبت شد' : 'Review Submitted',
      message: isRtl ? 'بازخورد ارزیابی عملکرد با موفقیت ثبت گردید.' : 'Talent review saved successfully.',
      type: 'success'
    });
  };

  // Delete Item Helpers
  const handleDeleteExperience = (id: string) => {
    setExperiences(prev => prev.filter(item => item.id !== id));
  };

  const handleDeleteEducation = (id: string) => {
    setEducations(prev => prev.filter(item => item.id !== id));
  };

  const handleDeleteCertification = (id: string) => {
    setCertifications(prev => prev.filter(item => item.id !== id));
  };

  const handleDeleteEvaluation = (id: string) => {
    setEvaluations(prev => prev.filter(item => item.id !== id));
  };

  const handleDeleteSuccessor = (id: string) => {
    setSuccessors(prev => prev.filter(item => item.id !== id));
  };

  // Quick State Toggles (Clear to 0% vs Load Sample Data)
  const handleClearAllData = () => {
    setExperiences([]);
    setEducations([]);
    setSkills([]);
    setCertifications([]);
    setEvaluations([]);
    setSuccessors([]);
    addNotification({
      title: isRtl ? 'پروفایل خام اولیه شد' : 'Blank Initial State',
      message: isRtl ? 'کلیه سوابق پاکسازی شدند (تکمیل ۰٪).' : 'All sections cleared to 0% completion.',
      type: 'info'
    });
  };

  const handleLoadSampleData = () => {
    setExperiences(sampleExperiences);
    setEducations(sampleEducations);
    setSkills(sampleSkills);
    setCertifications(sampleCertifications);
    setEvaluations(sampleEvaluations);
    setSuccessors(sampleSuccessors);
    addNotification({
      title: isRtl ? 'نمونه داده بارگذاری شد' : 'Sample Data Loaded',
      message: isRtl ? 'سوابق نمونه با موفقیت در پروفایل جای‌گذاری شدند.' : 'Sample records loaded successfully.',
      type: 'success'
    });
  };

  // Nominate Successor Handler
  const handleAddSuccessorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sucForm.name) return;

    const newSuc = {
      id: `suc-${Date.now()}`,
      name: sucForm.name,
      role: sucForm.role || 'عضو ارشد تیم',
      readiness: sucForm.readiness,
      matchScore: sucForm.matchScore,
      avatar: '/avatars/avatar-7.svg',
      risk: 'low'
    };

    setSuccessors([...successors, newSuc]);
    setShowAddSuccessorModal(false);
    setSucForm({
      name: '',
      role: '',
      readiness: 'آماده برای ارتقا (۶ ماه آینده)',
      matchScore: '۸۰٪'
    });

    addNotification({
      title: isRtl ? 'جانشین جدید پیشنهادی ثبت شد' : 'Successor Nominated',
      message: `${newSuc.name} ${isRtl ? 'به عنوان جانشین پیشنهادی ثبت گردید.' : 'nominated as successor.'}`,
      type: 'success'
    });
  };

  // Password Submit Handler
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.current || !passwordForm.newPass) {
      setPasswordToast(isRtl ? 'لطفا تمامی فیلدها را پر کنید.' : 'Please fill all fields.');
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirmPass) {
      setPasswordToast(isRtl ? 'رمز عبور جدید و تکرار آن یکسان نیستند.' : 'New passwords do not match.');
      return;
    }
    if(passwordForm.newPass.length < 12 || new TextEncoder().encode(passwordForm.newPass).length > 72) {
      setPasswordToast(isRtl ? 'رمز جدید باید حداقل ۱۲ نویسه و حداکثر ۷۲ بایت باشد.' : 'Password must be at least 12 characters and at most 72 bytes.'); return;
    }
    try {
      const response = await apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.newPass }) });
      await response.json();
      sessionStorage.setItem('orbit_auth_notice',isRtl ? 'رمز تغییر کرد؛ دوباره وارد شوید.' : 'Password changed; sign in again.');
      clearCredential();
    } catch(error) { setPasswordToast(error instanceof Error ? error.message : (isRtl ? 'تغییر رمز انجام نشد.' : 'Password change failed.')); }
  };

  // Workspace Invite Card State & Logic
  const [activeWs, setActiveWs] = useState<any>(null);
  const [copiedWsLink, setCopiedWsLink] = useState(false);
  const [isRegeneratingWs, setIsRegeneratingWs] = useState(false);
  const [wsToast, setWsToast] = useState<string | null>(null);

  useEffect(() => {
    const fetchActiveWs = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await apiFetch('/api/workspaces', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          const list = data.workspaces || [];
          const storedId = localStorage.getItem('activeWorkspaceId');
          const current = list.find((w: any) => w.id === storedId) || list[0];
          if (current) {
            setActiveWs(current);
          }
        }
      } catch {
        // Fallback local workspace
      }
    };
    setActiveWs(null);
    if(currentUser?.id)fetchActiveWs();
  }, [currentUser?.id,activeWorkspaceId]);

  const workspaceInviteCode = activeWs?.inviteCode || '';
  const workspaceInviteUrl = `${window.location.origin}/join/${workspaceInviteCode}`;

  const handleCopyInviteLink = () => {
    if(!workspaceInviteCode)return;
    navigator.clipboard.writeText(workspaceInviteUrl);
    setCopiedWsLink(true);
    setWsToast(isRtl ? 'لینک دعوت با موفقیت کپی شد.' : 'Invite link copied successfully.');
    setTimeout(() => {
      setCopiedWsLink(false);
      setWsToast(null);
    }, 2500);
  };

  const handleRegenerateInviteCode = async () => {
    setIsRegeneratingWs(true);
    try {
      const token = localStorage.getItem('token');
      const res = await apiFetch('/api/workspaces/regenerate-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ workspaceId: activeWs?.id })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.inviteCode) {
          setActiveWs((prev: any) => ({ ...prev, inviteCode: data.inviteCode }));
          setWsToast(isRtl ? 'کد دعوت جدید با موفقیت ایجاد و فعال شد.' : 'New invite code generated.');
          setTimeout(() => setWsToast(null), 3000);
        }
      }
    } catch {
      setWsToast(isRtl ? 'خطا در بازتولید کد دعوت' : 'Error regenerating invite code');
      setTimeout(() => setWsToast(null), 2500);
    } finally {
      setIsRegeneratingWs(false);
    }
  };

  // Absence Request Handler
  const handleAbsenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowAbsenceModal(false);
    addNotification({
      title: isRtl ? 'درخواست مرخصی ثبت شد' : 'Absence Request Submitted',
      message: `${absenceForm.type} ${isRtl ? 'برای بررسی به مدیریت ارسال شد.' : 'submitted for review.'}`,
      type: 'info'
    });
  };

  return (
    <div className="w-full min-w-0 overflow-x-hidden transition-all duration-300 font-sans text-slate-800 dark:text-slate-100 pb-12" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* MAIN 2-COLUMN GRID LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full min-w-0">

        {/* ================================================================= */}
        {/* COLUMN 1: LEFT PROFILE SIDEBAR (xl:col-span-5 2xl:col-span-4)     */}
        {/* ================================================================= */}
        <div className="xl:col-span-5 2xl:col-span-4 space-y-4 min-w-0">

          {/* 1. TOP SECTION HEADER & ACTION BUTTON */}
          <div className="flex items-center justify-between px-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isRtl ? 'پروفایل' : 'Profile'}
            </h1>
            <button
              onClick={() => setShowResumeModal(true)}
              className="bg-black dark:bg-white dark:text-black text-white px-4 py-1.5 rounded-full text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <span>{isRtl ? 'جزئیات' : 'Details'}</span>
              <ChevronRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* 2. CARD 1: SPLIT HERO PHOTO & DARK OVERVIEW CARD (2-COLUMN GRID) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 min-w-0">
            {/* Left Sub-Card: User Image & Identity Overlay */}
            <div className="h-[260px] rounded-3xl overflow-hidden relative shadow-md group border border-gray-100 dark:border-gray-800 min-w-0">
              <LocalImage
                src={profileData.avatar}
                alt={profileData.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-4 flex flex-col justify-between">
                {/* Top Right Overlay Pill */}
                <div className="flex justify-end">
                  <span className="bg-black/40 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full border border-white/20 font-semibold shadow-sm flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Level {profileData.level}</span>
                  </span>
                </div>

                {/* Bottom User Text */}
                <div className="min-w-0">
                  <h2 className="text-white text-xl font-bold leading-tight truncate">
                    {profileData.name}
                  </h2>
                  <p className="text-gray-300 text-xs mt-0.5 font-medium truncate">
                    {isRtl ? 'مدیر ارشد معماری سیستم' : 'Sr. Product Designer @ Unilever'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Sub-Card: Dark Quick Contact & Identity Card */}
            <div className="bg-[#0f172a] dark:bg-slate-900 rounded-3xl p-5 text-white shadow-xl border border-slate-800 flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-200">
                    {isRtl ? 'ارتباط سریع و مشخصات سازمان' : 'Quick Contact & Identity'}
                  </h3>
                  <span className="text-amber-400 text-xs">⚡</span>
                </div>

                <div className="space-y-3.5 text-xs">
                  {/* Item 1: Job Title */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 shrink-0">
                      {isRtl ? 'سمت سازمانی:' : 'Role:'}
                    </span>
                    <span className="font-semibold text-slate-100 text-right truncate">
                      {profileData.role || 'مدیر ارشد معماری سیستم (OWNER)'}
                    </span>
                  </div>

                  {/* Item 2: User ID */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 shrink-0">
                      {isRtl ? 'شناسه کاربری:' : 'User ID:'}
                    </span>
                    <span className="font-mono text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 dir-ltr">
                      {currentUser?.id || '—'}
                    </span>
                  </div>

                  {/* Item 3: Phone */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 shrink-0">
                      {isRtl ? 'شماره همراه:' : 'Phone:'}
                    </span>
                    <span className="font-medium text-slate-200 dir-ltr">
                      {profileData.phone || (isRtl ? 'ثبت نشده' : 'Not provided')}
                    </span>
                  </div>

                  {/* Item 4: Email */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 shrink-0">
                      {isRtl ? 'پست الکترونیک:' : 'Email:'}
                    </span>
                    <span className="font-medium text-slate-200 text-right truncate text-[11px]">
                      {profileData.email || (isRtl ? 'ثبت نشده' : 'Not provided')}
                    </span>
                  </div>

                  {/* Item 5: Office Address */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 shrink-0">
                      {isRtl ? 'نشانی دفتر:' : 'Office Address:'}
                    </span>
                    <span className="font-medium text-slate-200 text-right truncate text-[11px]">
                      {profileData.location || (isRtl ? 'ثبت نشده' : 'Not provided')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DEDICATED WORKSPACE INVITE & SHARING CARD */}
          <div className="relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br from-slate-900 via-indigo-950/80 to-blue-950/90 text-white shadow-xl border border-blue-500/30 dark:border-blue-500/40 space-y-4 mt-4 min-w-0">
            {/* Ambient Lighting */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

            {/* Header: Workspace Name & Badge */}
            <div className="flex items-center justify-between gap-2 border-b border-blue-400/20 pb-3 relative z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/30 shrink-0">
                  <Building2 size={18} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white truncate flex items-center gap-1.5">
                    <span>{isRtl ? 'لینک دعوت و اشتراک‌گذاری فضای کاری من' : 'My Workspace Invite & Share Link'}</span>
                  </h3>
                  <p className="text-[11px] text-blue-200/70 truncate mt-0.5 font-medium">
                    {activeWs?.name || (isRtl ? 'فضای کاری من' : 'My Workspace')}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-black font-mono px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300">
                {activeWs?.ownerId === currentUser?.id ? (isRtl ? '🏢 مدیر کل / OWNER' : 'OWNER') : (isRtl ? 'عضو کارگاه' : 'MEMBER')}
              </span>
            </div>

            {/* Invite Code Display & Direct URL Field */}
            <div className="space-y-2 relative z-10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-200/80 font-bold flex items-center gap-1.5">
                  <KeyRound size={13} className="text-amber-400" />
                  <span>{isRtl ? 'کد اختصاصی دعوت:' : 'Invite Code:'}</span>
                </span>
                <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 tracking-wider">
                  {workspaceInviteCode}
                </span>
              </div>

              {/* Direct Invite URL Input Field */}
              <div className="relative flex items-center">
                <input
                  type="text"
                  readOnly
                  value={workspaceInviteUrl}
                  dir="ltr"
                  className="w-full h-11 px-3.5 rounded-2xl bg-slate-950/70 border border-blue-400/30 text-blue-200 font-mono text-xs text-left select-all focus:outline-none focus:border-blue-400 transition-all cursor-text shadow-inner"
                />
              </div>
            </div>

            {/* Action Buttons: One-Click Copy & Regenerate */}
            <div className="flex items-center gap-2 pt-1 relative z-10">
              <button
                type="button"
                onClick={handleCopyInviteLink}
                className="flex-1 h-10 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/30 active:scale-[0.98]"
              >
                {copiedWsLink ? (
                  <>
                    <CheckCheck size={16} className="text-emerald-400" />
                    <span className="text-emerald-300">{isRtl ? 'لینک کپی شد!' : 'Link Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Copy size={15} />
                    <span>{isRtl ? 'کپی لینک مستقیم دعوت' : 'Copy Direct Invite Link'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRegenerateInviteCode}
                disabled={isRegeneratingWs}
                title={isRtl ? 'تولید مجدد کد دعوت برای امنیت بیشتر' : 'Regenerate invite code'}
                className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
              >
                <RefreshCw size={14} className={isRegeneratingWs ? 'animate-spin text-blue-400' : ''} />
                <span className="text-[11px] hidden sm:inline">{isRtl ? 'تغییر کد' : 'Reset'}</span>
              </button>
            </div>

            {/* Animated Toast / Notification Message */}
            {wsToast && (
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
                <CheckCheck size={14} className="text-emerald-400 shrink-0" />
                <span>{wsToast}</span>
              </div>
            )}
          </div>

          {/* 3. CARD 2: STACKED BAR CHART CARD (LAST 5 YEARS SALARY / PERFORMANCE) */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/60 mt-4 min-w-0">
            {/* Header Row with Title and Legends */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                {isRtl ? 'درآمد و راندمان ۵ سال اخیر' : 'Last 5 Years Salary'}
              </h3>

              {/* Legend Indicators */}
              <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                  <span>BASE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                  <span>BONUS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#14b8a6]" />
                  <span>EQUITY</span>
                </div>
              </div>
            </div>

            {/* Stacked Bar Chart Display */}
            <div className="relative pt-2 pb-1 min-w-0">
              <div className="flex items-end justify-between gap-2 h-48 pl-9 pr-1 relative border-b border-gray-100 dark:border-gray-700/80 pb-2">
                {/* Y-Axis Labels */}
                <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[10px] font-mono text-gray-400">
                  <span>100K</span>
                  <span>80K</span>
                  <span>60K</span>
                  <span>40K</span>
                  <span>20K</span>
                  <span>1K</span>
                  <span>0</span>
                </div>

                {/* Background Grid Lines */}
                <div className="absolute left-9 right-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none opacity-20">
                  <div className="border-b border-gray-300 dark:border-gray-600 w-full" />
                  <div className="border-b border-gray-300 dark:border-gray-600 w-full" />
                  <div className="border-b border-gray-300 dark:border-gray-600 w-full" />
                  <div className="border-b border-gray-300 dark:border-gray-600 w-full" />
                  <div className="border-b border-gray-300 dark:border-gray-600 w-full" />
                  <div className="border-b border-gray-300 dark:border-gray-600 w-full" />
                </div>

                {/* Bars Data */}
                {[
                  { year: '2022', base: 45, bonus: 15, equity: 10, total: '$70K' },
                  { year: '2023', base: 55, bonus: 18, equity: 12, total: '$85K' },
                  { year: '2024', base: 65, bonus: 20, equity: 15, total: '$100K' },
                  { year: '2025', base: 75, bonus: 22, equity: 18, total: '$115K' },
                  { year: '2026', base: 85, bonus: 25, equity: 20, total: '$130K' }
                ].map((bar) => (
                  <div key={bar.year} className="flex-1 flex flex-col items-center group relative z-10 min-w-0">
                    {/* Hover Tooltip */}
                    <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gray-900 text-white text-[10px] font-mono px-2.5 py-1 rounded-lg shadow-xl pointer-events-none z-20 whitespace-nowrap">
                      {bar.year}: {bar.total}
                    </div>

                    {/* Stacked Bar Pillar */}
                    <div className="w-full max-w-[34px] flex flex-col justify-end overflow-hidden rounded-xl transition-all duration-300 group-hover:scale-105 group-hover:shadow-md cursor-pointer h-36 bg-gray-100 dark:bg-gray-700/30 p-0.5">
                      <div className="w-full h-full flex flex-col justify-end overflow-hidden rounded-lg">
                        {/* Top Segment: Equity */}
                        <div
                          style={{ height: `${bar.equity}%` }}
                          className="w-full bg-[#14b8a6] hover:brightness-110 transition-all"
                          title={`Equity: ${bar.equity}%`}
                        />
                        {/* Middle Segment: Bonus */}
                        <div
                          style={{ height: `${bar.bonus}%` }}
                          className="w-full bg-[#f97316] hover:brightness-110 transition-all"
                          title={`Bonus: ${bar.bonus}%`}
                        />
                        {/* Bottom Segment: Base */}
                        <div
                          style={{ height: `${bar.base}%` }}
                          className="w-full bg-[#2563eb] hover:brightness-110 transition-all"
                          title={`Base: ${bar.base}%`}
                        />
                      </div>
                    </div>

                    {/* X-Axis Year Label */}
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mt-2 font-mono">
                      {bar.year}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. CARD 3: WORK HISTORY ITEMS (LAST 3 POSITIONS) */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/60 mt-4 min-w-0">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
              {isRtl ? '۳ موقعیت شغلی اخیر' : 'Last 3 Positions'}
            </h3>

            <div className="space-y-3">
              {/* Item 1 */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 hover:shadow-sm transition-all min-w-0">
                <div className="text-[10px] text-gray-400 tracking-wider font-semibold uppercase mb-2">
                  JAN 1, 2020 - TODAY (6 YEARS)
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white shrink-0 font-black text-xs shadow-sm">
                    Aero
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      Sr. Product Manager
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      AeroVelo Logistics • Product Strategy
                    </p>
                  </div>
                </div>
              </div>

              {/* Item 2 */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 hover:shadow-sm transition-all min-w-0">
                <div className="text-[10px] text-gray-400 tracking-wider font-semibold uppercase mb-2">
                  JAN 1, 2018 - JAN 1, 2020 (2 YEARS)
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0 font-black text-xs shadow-sm">
                    Nex
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      Sr. Product Manager
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      Nexis Core • Product Strategy
                    </p>
                  </div>
                </div>
              </div>

              {/* Item 3 */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 hover:shadow-sm transition-all min-w-0">
                <div className="text-[10px] text-gray-400 tracking-wider font-semibold uppercase mb-2">
                  JAN 1, 2019 - JAN 1, 2020 (1 YEAR)
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center text-white shrink-0 font-black text-xs shadow-sm">
                    Vor
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                      Sr. Product Manager
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      Vortex Analysis • Product & Data
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. CARD 4: PROFILE COMPLETION CARD (تکمیل پروفایل کاربر) */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700/60 mt-4 min-w-0 space-y-4">
            {/* Header with Title & Percentage */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {isRtl ? 'تکمیل پروفایل کاربر' : 'Profile Completion'}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                    {isRtl ? 'میزان تکمیل سوابق و مدارک شغلی' : 'Completion progress of profile records'}
                  </p>
                </div>
              </div>

              <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                {toPersianDigits(completionPercentage)}%
              </span>
            </div>

            {/* Glowing Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-gray-100 dark:bg-gray-700/50 h-3 rounded-full overflow-hidden p-0.5 border border-gray-200/50 dark:border-gray-600/50">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 h-full rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>

            {/* Interactive Checklist Items */}
            <div className="space-y-2 pt-1 text-xs">
              {completionChecklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 transition-all group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 transition-all ${
                      item.completed ? 'bg-emerald-500 text-white shadow-sm' : 'border border-gray-300 dark:border-gray-600 group-hover:border-gray-400'
                    }`}>
                      {item.completed && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className={`text-xs font-semibold truncate ${item.completed ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                      {item.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                    +{toPersianDigits(item.points)}%
                  </span>
                </div>
              ))}
            </div>

            {/* Complete My Profile Button */}
            <button
              onClick={() => setShowCompletionModal(true)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isRtl ? 'تکمیل کامل پروفایل' : 'Complete My Profile'}</span>
            </button>
          </div>

        </div>


        {/* ================================================================= */}
        {/* COLUMN 2: RIGHT MAIN CONTENT DASHBOARD AREA (xl:col-span-7 2xl:col-span-8) */}
        {/* ================================================================= */}
        <div className="xl:col-span-7 2xl:col-span-8 space-y-6 min-w-0">

          {/* TOP PILL NAVIGATION BAR */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-black text-slate-900 dark:text-slate-100">
                  داشبورد تخصصی رزومه و منابع انسانی
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                  مدیریت سوابق کاری، چارت سلسله‌مراتب سازمانی و ارزیابی استعدادها
                </p>
              </div>
            </div>

            {/* Quick State Toggle Buttons for Testing */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearAllData}
                className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                title="پاکسازی کلیه سوابق جهت تست حالت خام اولیه (۰٪)"
              >
                {isRtl ? 'حالت اولیه / خالی (۰٪)' : 'Clear to 0%'}
              </button>
              <button
                onClick={handleLoadSampleData}
                className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-blue-200 dark:border-blue-800"
                title="بارگذاری نمونه داده برای مشاهده پروفایل پرشده"
              >
                {isRtl ? 'بارگذاری نمونه داده' : 'Load Sample'}
              </button>

              {/* 3 Pill Tabs */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                <button
                  onClick={() => setActiveTabMode('resume')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTabMode === 'resume'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>رزومه و سوابق</span>
                </button>

                <button
                  onClick={() => setActiveTabMode('orgChart')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTabMode === 'orgChart'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>چارت سازمانی</span>
                </button>

                <button
                  onClick={() => setActiveTabMode('talentReview')}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTabMode === 'talentReview'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>ارزیابی عملکرد</span>
                </button>
              </div>
            </div>
          </div>


          {/* ----------------------------------------------------------------- */}
          {/* TAB 1: RESUME & EXPERIENCES (رزومه و سوابق)                        */}
          {/* ----------------------------------------------------------------- */}
          {activeTabMode === 'resume' && (
            <div className="space-y-6">

              {/* BIO / OVERVIEW SUMMARY CARD */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" />
                    <span>خلاصه بیوگرافی و اهداف حرفه‌ای</span>
                  </h3>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                    تایید شده HR
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {profileData.bio}
                </p>
              </div>

              {/* WORK EXPERIENCES SECTION */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-500" />
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">سوابق شغلی و پروژه‌ها (Work Experiences)</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">پیشینه مدیریتی و فنی به ترتیب زمانی</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowAddExperienceModal(true)}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ افزودن سابقه جدید</span>
                  </button>
                </div>

                {/* Experiences Timeline or Empty State */}
                {experiences.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700/80 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {isRtl ? 'هیچ سابقه شغلی ثبت نشده است' : 'No Work Experience Recorded'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        {isRtl ? 'برای تکمیل رزومه و ارتقای امتیاز، اولین سابقه شغلی خود را اضافه کنید.' : 'Add your first work experience to complete your resume.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddExperienceModal(true)}
                      className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-2xl transition-all shadow-md cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isRtl ? '+ افزودن سابقه کاری' : '+ Add Work Experience'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 relative before:absolute before:right-6 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 pr-10">
                    {experiences.map((exp) => (
                      <div key={exp.id} className="relative space-y-2 group">
                        {/* Timeline Node Dot */}
                        <div className="absolute -right-10 top-1 w-4 h-4 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900 shadow-md flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>

                        {/* Header Row */}
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {exp.title}
                            </h4>
                            <div className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2 mt-0.5">
                              <span>{exp.company}</span>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span className="text-slate-500 dark:text-slate-400 font-normal">{exp.location}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl">
                              {exp.period}
                            </span>
                            <button
                              onClick={() => handleDeleteExperience(exp.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-all cursor-pointer"
                              title="حذف سابقه"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                          {exp.description}
                        </p>

                        {/* Stat Badges */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            {exp.levelBadge}
                          </span>
                          <span className="text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800">
                            {exp.teamManaged}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* EDUCATIONS SECTION */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-purple-500" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">تحصیلات و مدارک آکادمیک (Educations)</h3>
                  </div>
                  <button
                    onClick={() => setShowAddEducationModal(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    + افزودن مدرک تحصیلی
                  </button>
                </div>

                {educations.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700/80 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                      <Award className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {isRtl ? 'هیچ مدرک تحصیلی ثبت نشده است' : 'No Education Recorded'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        {isRtl ? 'اطلاعات مقاطع تحصیلی و آکادمیک خود را وارد نمایید.' : 'Add your academic background.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddEducationModal(true)}
                      className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-2xl transition-all shadow-md cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isRtl ? '+ افزودن مدرک تحصیلی' : '+ Add Education'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {educations.map((edu) => (
                      <div
                        key={edu.id}
                        className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-2 hover:border-blue-400 dark:hover:border-blue-500 transition-all relative group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">{edu.degree}</h4>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded-md">
                              {edu.period}
                            </span>
                            <button
                              onClick={() => handleDeleteEducation(edu.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="حذف"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{edu.university}</div>
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">{edu.grade}</div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">{edu.details}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CERTIFICATIONS & LICENSES LIST */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">گواهینامه‌های تخصصی و بین‌المللی</h3>
                  </div>
                  <button
                    onClick={() => setShowAddCertificationModal(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    + افزودن گواهی‌نامه
                  </button>
                </div>

                {certifications.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700/80 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {isRtl ? 'هیچ گواهی‌نامه بین‌المللی ثبت نشده است' : 'No Certifications Recorded'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        {isRtl ? 'مدارک دوره‌ها و گواهی‌نامه‌های تخصصی خود را اضافه کنید.' : 'Add your professional certificates.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddCertificationModal(true)}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-2xl transition-all shadow-md cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isRtl ? '+ افزودن گواهی‌نامه' : '+ Add Certification'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {certifications.map((cert) => (
                      <div
                        key={cert.id}
                        className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                            <FileCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 dark:text-slate-100">{cert.title}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{cert.issuer} • {cert.date}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowResumeModal(true)}
                            className="p-2 rounded-xl bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all cursor-pointer"
                            title="مشاهده مدرک"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCertification(cert.id)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-all cursor-pointer"
                            title="حذف"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}


          {/* ----------------------------------------------------------------- */}
          {/* TAB 2: ORGANIZATIONS CHART (چارت سازمانی)                           */}
          {/* ----------------------------------------------------------------- */}
          {activeTabMode === 'orgChart' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-blue-500" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">چارت سلسله‌مراتب سازمانی و شاخص Retention Risk</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">نگاشت ساختار سازمانی و پایش ریسک خروج نیروها</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>ریسک پایین (Low)</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>ریسک متوسط</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>ریسک بالا (High)</span>
                  </span>
                </div>
              </div>

              {/* TREE DIAGRAM CONTAINER */}
              <div className="space-y-8 pt-2">
                
                {/* LEVEL 1: DIRECT MANAGER NODE */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] font-black text-slate-400 mb-1">مدیر مستقیم (Direct Manager)</div>
                  <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md min-w-[260px] flex items-center gap-3">
                    <LocalImage
                      src="/avatars/avatar-0.svg"
                      alt="Devon Lane"
                      className="w-12 h-12 rounded-xl object-cover ring-2 ring-blue-500"
                    />
                    <div className="text-xs space-y-0.5">
                      <div className="font-black text-white">Devon Lane</div>
                      <div className="text-[10px] text-blue-400 font-bold">Project Manager & CSO</div>
                      <div className="text-[9px] text-slate-400">دپارتمان راهبرد و استراتژی</div>
                    </div>
                  </div>

                  {/* Vertical Connector Line */}
                  <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-700 my-1" />
                </div>

                {/* LEVEL 2: ACTIVE USER NODE (CENTER) & PEERS */}
                <div className="flex flex-col items-center">
                  <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 mb-1">نقش فعال شما (Active Profile Node)</div>
                  
                  <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg ring-4 ring-blue-500/30 min-w-[300px] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <LocalImage
                          src={profileData.avatar}
                          alt={profileData.name}
                          className="w-12 h-12 rounded-xl object-cover ring-2 ring-white"
                        />
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-blue-600" title="Low Retention Risk" />
                      </div>
                      <div className="text-xs space-y-0.5">
                        <div className="font-black text-white text-sm">{profileData.name}</div>
                        <div className="text-[10px] text-blue-200 font-bold">{profileData.jobTitle}</div>
                        <div className="text-[9px] text-blue-100">مدیریت ۲۴ عضو ارشد تیم</div>
                      </div>
                    </div>

                    <span className="text-[10px] font-black bg-white/20 text-white px-2.5 py-1 rounded-full border border-white/30">
                      افتخاری / OWNER
                    </span>
                  </div>

                  {/* Vertical Connector Line to Subordinates */}
                  <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-700 my-1" />
                </div>

                {/* LEVEL 3: DIRECT REPORTS / TEAM MEMBERS (SUBORDINATES) */}
                <div className="space-y-3">
                  <div className="text-center text-[10px] font-black text-slate-500 dark:text-slate-400">
                    اعضای مستقیم زیرمجموعه و دپارتمان‌ها (Direct Reports - 24 Members)
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { name: 'مریم رضایی', role: 'Lead UI/UX Designer', dept: 'طراحی', risk: 'low', avatar: '/avatars/avatar-7.svg' },
                      { name: 'محمد حسینی', role: 'Senior Frontend Dev', dept: 'توسعه وب', risk: 'low', avatar: '/avatars/avatar-3.svg' },
                      { name: 'سارا احمدی', role: 'QA & Testing Lead', dept: 'کیفیت نرم‌افزار', risk: 'low', avatar: '/avatars/avatar-7.svg' },
                      { name: 'امیر پوررضا', role: 'PLC & Hardware Eng.', dept: 'اتوماسیون', risk: 'medium', avatar: '/avatars/avatar-3.svg' },
                      { name: 'رضا اکبری', role: 'DevOps & Cloud Lead', dept: 'زیرساخت', risk: 'low', avatar: '/avatars/avatar-0.svg' },
                      { name: 'نیلوفر کریمی', role: 'Content Strategist', dept: 'تولید محتوا', risk: 'high', avatar: '/avatars/avatar-1.svg' },
                    ].map((m, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 hover:border-blue-500 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <LocalImage src={m.avatar} alt={m.name} className="w-10 h-10 rounded-xl object-cover" />
                            <span
                              className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-800 ${
                                m.risk === 'low' ? 'bg-emerald-500' : m.risk === 'medium' ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                            />
                          </div>
                          <div className="text-xs">
                            <div className="font-black text-slate-900 dark:text-slate-100">{m.name}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{m.role}</div>
                          </div>
                        </div>

                        <span className="text-[9px] font-bold bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-md">
                          {m.dept}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}


          {/* ----------------------------------------------------------------- */}
          {/* TAB 3: TALENT REVIEW (ارزیابی عملکرد و نظرات)                       */}
          {/* ----------------------------------------------------------------- */}
          {activeTabMode === 'talentReview' && (
            <div className="space-y-6">

              {/* 9-BOX STATUS OVERVIEW CARD */}
              <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                      <span>ماتریس ۹ خانه‌ای و وضعیت Talent Review</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                      ارزیابی سرمایه‌های انسانی و پتانسیل رشد سازمانی
                    </p>
                  </div>

                  <span className="text-xs font-black bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
                    وضعیت: {evaluations.length > 0 ? (evaluations[0]?.statusBadge || 'High Potential / Core Star') : 'در انتظار ارزیابی اولیه / New Talent'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400">شاخص اثرگذاری (Impact Score)</span>
                    <div className="text-lg font-black font-mono text-emerald-400">
                      {evaluations.length > 0 ? '۹.۸ از ۱۰' : 'ثبت‌نشده (۰٪)'}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400">پتانسیل ارتقا به مدیریت ارشد</span>
                    <div className="text-lg font-black font-mono text-blue-400">
                      {evaluations.length > 0 ? 'ممتاز (بسیار بالا)' : 'در حال ارزیابی'}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400">ریسک خروج (Retention Risk)</span>
                    <div className="text-lg font-black font-mono text-emerald-400">
                      {evaluations.length > 0 ? '🟢 پایین (Low)' : '⚪ نامشخص'}
                    </div>
                  </div>
                </div>
              </div>

              {/* MANAGERIAL EVALUATION FEEDBACK TIMELINE */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">ارزیابی‌های عملکرد مدیریتی (Managerial Reviews)</h3>
                  </div>

                  <button
                    onClick={() => setShowAddReviewModal(true)}
                    className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ ثبت ارزیابی و بازخورد جدید</span>
                  </button>
                </div>

                {evaluations.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700/80 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                      <Star className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {isRtl ? 'هیچ ارزیابی عملکردی ثبت نشده است' : 'No Reviews Recorded'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        {isRtl ? 'برای این کاربر هنوز بازخورد مدیریتی یا ارزیابی Talent Review ثبت نگردیده است.' : 'No manager reviews recorded yet.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddReviewModal(true)}
                      className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black px-4 py-2 rounded-2xl transition-all shadow-md cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isRtl ? '+ ثبت ارزیابی و بازخورد جدید' : '+ Write Review'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {evaluations.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-slate-100">{ev.evaluator}</span>
                            <span className="text-[10px] bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 font-bold px-2 py-0.5 rounded-md">
                              {ev.statusBadge}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-400">{ev.date}</span>
                            <button
                              onClick={() => handleDeleteEvaluation(ev.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                              title="حذف"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                          "{ev.notes}"
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5">
                            {ev.tags.map((t: string, idx: number) => (
                              <span key={idx} className="text-[10px] bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded-md">
                                #{t}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            امتیاز: {ev.rating}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SUCCESSION PLANNING (جانشینان پیشنهادی) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-500" />
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">جانشینان پیشنهادی (Succession Planning)</h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">نیروهای آماده ارتقا جهت حفظ تداوم کسب‌وکار</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowAddSuccessorModal(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                  >
                    + پیشنهاد جانشین جدید
                  </button>
                </div>

                {successors.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700/80 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {isRtl ? 'هیچ جانشینی تعیین نشده است' : 'No Successors Nominated'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        {isRtl ? 'جانشینان احتمالی این پست سازمانی را مشخص کنید.' : 'Nominate potential successors.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddSuccessorModal(true)}
                      className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-2xl transition-all shadow-md cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isRtl ? '+ پیشنهاد جانشین جدید' : '+ Nominate Successor'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {successors.map((suc) => (
                      <div
                        key={suc.id}
                        className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 relative group"
                      >
                        <div className="flex items-center gap-3">
                          <LocalImage src={suc.avatar} alt={suc.name} className="w-11 h-11 rounded-xl object-cover ring-2 ring-purple-500/30" />
                          <div className="text-xs space-y-0.5">
                            <div className="font-black text-slate-900 dark:text-slate-100">{suc.name}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{suc.role}</div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{suc.readiness}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-center bg-purple-50 dark:bg-purple-950 p-2 rounded-xl border border-purple-200 dark:border-purple-800">
                            <div className="text-[9px] text-purple-600 dark:text-purple-300 font-bold">تطبیق</div>
                            <div className="text-xs font-black font-mono text-purple-900 dark:text-purple-100">{suc.matchScore}</div>
                          </div>
                          <button
                            onClick={() => handleDeleteSuccessor(suc.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                            title="حذف"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>

      {/* ================================================================= */}
      {/* MODALS & POPUPS                                                   */}
      {/* ================================================================= */}

      {/* 1. COMPLETE PROFILE MODAL */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            onClick={() => setShowCompletionModal(false)}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] p-6 max-w-md w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-5" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                <span>تکمیل کامل پروفایل و دریافت مدال</span>
              </h3>
              <button onClick={() => setShowCompletionModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              با تکمیل آیتم‌های زیر، نشان طلایی «پروفایل کامل HR» را دریافت کرده و شانس ارتقاء رتبه را افزایش دهید.
            </p>

            <div className="space-y-2 text-xs">
              {completionChecklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <span className="font-bold text-slate-800 dark:text-slate-100">{item.label}</span>
                  <input type="checkbox" checked={item.completed} readOnly className="w-4 h-4 rounded text-emerald-600 pointer-events-none" />
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setShowCompletionModal(false);
                addNotification({
                  title: isRtl ? 'پروفایل به‌روزرسانی شد' : 'Profile Updated',
                  message: isRtl ? 'میزان تکمیل پروفایل شما ثبت گردید.' : 'Profile completion status saved.',
                  type: 'success'
                });
              }}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all cursor-pointer"
            >
              ذخیره تغییرات
            </button>
          </div>
        </div>
      )}

      {/* 2. RESUME VIEW / PRINT MODAL */}
      {showResumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            onClick={() => setShowResumeModal(false)}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] p-6 max-w-2xl w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-5 max-h-[85vh] overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <span>پیش‌نمایش فرم استاندارد رزومه (Resume View)</span>
              </h3>
              <button onClick={() => setShowResumeModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
              <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <LocalImage src={profileData.avatar} alt={profileData.name} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-blue-500" />
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100">{profileData.name}</h2>
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-bold">{profileData.jobTitle}</div>
                  <div className="text-[10px] text-slate-500">{profileData.email} • {profileData.phone}</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-black text-slate-900 dark:text-slate-100 border-b pb-1">سوابق شغلی</h4>
                {experiences.map(e => (
                  <div key={e.id} className="space-y-0.5">
                    <div className="font-bold text-slate-800 dark:text-slate-200">{e.title} - {e.company} ({e.period})</div>
                    <p className="text-slate-500 text-[11px]">{e.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>دانلود نسخه PDF / چاپ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ADD EXPERIENCE MODAL */}
      {showAddExperienceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            onClick={() => setShowAddExperienceModal(false)}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <form onSubmit={handleAddExperienceSubmit} className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] p-6 max-w-lg w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-500" />
                <span>افزودن سابقه کاری جدید</span>
              </h3>
              <button type="button" onClick={() => setShowAddExperienceModal(false)} className="text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">عنوان شغلی / سمت</label>
                <input
                  type="text"
                  required
                  placeholder="مثلا: مدیر فنی و سرپرست تیم"
                  value={expForm.title}
                  onChange={(e) => setExpForm({ ...expForm, title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">نام شرکت / سازمان</label>
                <input
                  type="text"
                  required
                  placeholder="مثلا: آژانس داروماپک"
                  value={expForm.company}
                  onChange={(e) => setExpForm({ ...expForm, company: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">دوره زمانی</label>
                  <input
                    type="text"
                    placeholder="۱۴۰۱ - تاکنون"
                    value={expForm.period}
                    onChange={(e) => setExpForm({ ...expForm, period: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">موقعیت مکانی</label>
                  <input
                    type="text"
                    placeholder="تهران، ایران"
                    value={expForm.location}
                    onChange={(e) => setExpForm({ ...expForm, location: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">توضیحات و دستاوردها</label>
                <textarea
                  rows={3}
                  placeholder="شرح وظایف و دستاوردهای کلیدی..."
                  value={expForm.description}
                  onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
            >
              ذخیره سابقه کاری
            </button>
          </form>
        </div>
      )}

      {/* 4. ADD EDUCATION MODAL */}
      {showAddEducationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            onClick={() => setShowAddEducationModal(false)}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <form onSubmit={handleAddEducationSubmit} className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] p-6 max-w-lg w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-500" />
                <span>افزودن مدرک تحصیلی جدید</span>
              </h3>
              <button type="button" onClick={() => setShowAddEducationModal(false)} className="text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">رشته و مقطع تحصیلی</label>
                <input
                  type="text"
                  required
                  placeholder="مثلا: کارشناسی ارشد مهندسی نرم‌افزار"
                  value={eduForm.degree}
                  onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">نام دانشگاه / موسسه</label>
                <input
                  type="text"
                  required
                  placeholder="دانشگاه تهران"
                  value={eduForm.university}
                  onChange={(e) => setEduForm({ ...eduForm, university: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">سال‌های تحصیل</label>
                  <input
                    type="text"
                    placeholder="۱۳۹۸ - ۱۴۰۱"
                    value={eduForm.period}
                    onChange={(e) => setEduForm({ ...eduForm, period: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">معدل / وضعیت</label>
                  <input
                    type="text"
                    placeholder="معدل: ۱۸.۸۵"
                    value={eduForm.grade}
                    onChange={(e) => setEduForm({ ...eduForm, grade: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
            >
              ثبت مدرک تحصیلی
            </button>
          </form>
        </div>
      )}

      {/* 5. CHANGE PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            onClick={() => setShowPasswordModal(false)}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <form onSubmit={handlePasswordSubmit} className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] p-6 max-w-sm w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-500" />
                <span>تغییر رمز عبور حساب کاربری</span>
              </h3>
              <button type="button" onClick={() => setShowPasswordModal(false)} className="text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordToast && (
              <div className="p-3 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold text-center">
                {passwordToast}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">رمز عبور فعلی</label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">رمز عبور جدید</label>
                <input
                  type="password"
                  value={passwordForm.newPass}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">تکرار رمز عبور جدید</label>
                <input
                  type="password"
                  value={passwordForm.confirmPass}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPass: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
            >
              به‌روزرسانی رمز عبور
            </button>
          </form>
        </div>
      )}

      {/* 6. ABSENCE REQUEST MODAL */}
      {showAbsenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            onClick={() => setShowAbsenceModal(false)}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <form onSubmit={handleAbsenceSubmit} className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] p-6 max-w-md w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-purple-500" />
                <span>ثبت درخواست مرخصی جدید</span>
              </h3>
              <button type="button" onClick={() => setShowAbsenceModal(false)} className="text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">نوع مرخصی</label>
                <select
                  value={absenceForm.type}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, type: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                >
                  <option value="مرخصی استحقاقی (Vacation)">مرخصی استحقاقی (Vacation)</option>
                  <option value="مرخصی استعلاجی (Sick Leave)">مرخصی استعلاجی (Sick Leave)</option>
                  <option value="مرخصی ساعتی">مرخصی ساعتی</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">تاریخ شروع</label>
                  <input
                    type="text"
                    value={absenceForm.startDate}
                    onChange={(e) => setAbsenceForm({ ...absenceForm, startDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">تاریخ پایان</label>
                  <input
                    type="text"
                    value={absenceForm.endDate}
                    onChange={(e) => setAbsenceForm({ ...absenceForm, endDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">علت و توضیحات</label>
                <textarea
                  rows={2}
                  value={absenceForm.reason}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, reason: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
            >
              ارسال درخواست مرخصی
            </button>
          </form>
        </div>
      )}

      {/* 7. ADD SUCCESSOR MODAL */}
      {showAddSuccessorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            onClick={() => setShowAddSuccessorModal(false)}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <form onSubmit={handleAddSuccessorSubmit} className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] p-6 max-w-md w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                <span>پیشنهاد جانشین جدید (Nominate Successor)</span>
              </h3>
              <button type="button" onClick={() => setShowAddSuccessorModal(false)} className="text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">نام و نام خانوادگی عضو تیم</label>
                <input
                  type="text"
                  required
                  placeholder="مثلا: مریم رضایی"
                  value={sucForm.name}
                  onChange={(e) => setSucForm({ ...sucForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">نقش فعلی</label>
                <input
                  type="text"
                  placeholder="Senior Frontend Lead"
                  value={sucForm.role}
                  onChange={(e) => setSucForm({ ...sucForm, role: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">زمان آمادگی</label>
                  <select
                    value={sucForm.readiness}
                    onChange={(e) => setSucForm({ ...sucForm, readiness: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  >
                    <option value="آماده برای ارتقا (۶ ماه آینده)">۶ ماه آینده</option>
                    <option value="نیازمند آموزش (۱۲ ماه آینده)">۱۲ ماه آینده</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">میزان تطبیق</label>
                  <input
                    type="text"
                    value={sucForm.matchScore}
                    onChange={(e) => setSucForm({ ...sucForm, matchScore: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
            >
              ثبت جانشین پیشنهادی
            </button>
          </form>
        </div>
      )}

      {/* 8. ADD CERTIFICATION MODAL */}
      {showAddCertificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            onClick={() => setShowAddCertificationModal(false)}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <form onSubmit={handleAddCertificationSubmit} className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] p-6 max-w-md w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span>افزودن گواهی‌نامه تخصصی و بین‌المللی</span>
              </h3>
              <button type="button" onClick={() => setShowAddCertificationModal(false)} className="text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">عنوان گواهی‌نامه / مدرک</label>
                <input
                  type="text"
                  required
                  placeholder="مثلا: AWS Certified Solutions Architect"
                  value={certForm.title}
                  onChange={(e) => setCertForm({ ...certForm, title: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">مرجع صادرکننده</label>
                <input
                  type="text"
                  required
                  placeholder="مثلا: Amazon Web Services / ISO"
                  value={certForm.issuer}
                  onChange={(e) => setCertForm({ ...certForm, issuer: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">سال / تاریخ دریافت</label>
                  <input
                    type="text"
                    placeholder="۲۰۲۴"
                    value={certForm.date}
                    onChange={(e) => setCertForm({ ...certForm, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">فرمت فایل مدرک</label>
                  <select
                    value={certForm.type}
                    onChange={(e) => setCertForm({ ...certForm, type: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  >
                    <option value="pdf">فایل PDF</option>
                    <option value="jpg">تصویر / JPG</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
            >
              ذخیره گواهی‌نامه
            </button>
          </form>
        </div>
      )}

      {/* 9. WRITE REVIEW / TALENT EVALUATION MODAL (Styled like Write Review in cd33edf4a662dc0c8fa1f3610726216b.jpg) */}
      {showAddReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div 
            onClick={() => setShowAddReviewModal(false)}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <form onSubmit={handleAddReviewSubmit} className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] p-6 max-w-lg w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <span>ثبت ارزیابی و بازخورد مدیریتی جدید (Write Review)</span>
              </h3>
              <button type="button" onClick={() => setShowAddReviewModal(false)} className="text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">نام و سمت ارزیاب (Evaluator)</label>
                  <input
                    type="text"
                    required
                    placeholder="Devon Lane (مدیر ارشد پروژه‌ها)"
                    value={reviewForm.evaluator}
                    onChange={(e) => setReviewForm({ ...reviewForm, evaluator: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">تاریخ ارزیابی (Date)</label>
                  <input
                    type="text"
                    placeholder="مرداد ۱۴۰۳"
                    value={reviewForm.date}
                    onChange={(e) => setReviewForm({ ...reviewForm, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">امتیاز عملکرد (Rating Score)</label>
                  <select
                    value={reviewForm.rating}
                    onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  >
                    <option value="۵ از ۵ (ممتاز)">۵ از ۵ (ممتاز)</option>
                    <option value="۴.۵ از ۵ (خیلی خوب)">۴.۵ از ۵ (خیلی خوب)</option>
                    <option value="۴ از ۵ (خوب)">۴ از ۵ (خوب)</option>
                    <option value="۳.۵ از ۵ (متوسط)">۳.۵ از ۵ (متوسط)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">برچسب وضعیت (Status Badge)</label>
                  <select
                    value={reviewForm.statusBadge}
                    onChange={(e) => setReviewForm({ ...reviewForm, statusBadge: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                  >
                    <option value="High Potential / Core Star">High Potential / Core Star</option>
                    <option value="Solid Leader">Solid Leader</option>
                    <option value="Key Contributor">Key Contributor</option>
                    <option value="Exceeds Expectations">Exceeds Expectations</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">برچسب‌ها و موضوعات (Tags - با کاما جدا کنید)</label>
                <input
                  type="text"
                  placeholder="استراتژی فنی, رهبری تیم, کیفیت کد"
                  value={reviewForm.tags}
                  onChange={(e) => setReviewForm({ ...reviewForm, tags: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">توضیحات و بازخورد تفصیلی (Review Notes)</label>
                <textarea
                  rows={4}
                  required
                  placeholder="بازخورد عملکرد، نقاط قوت و زمینه‌های توسعه..."
                  value={reviewForm.notes}
                  onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer transition-all"
            >
              ثبت ارزیابی و بازخورد
            </button>
          </form>
        </div>
      )}

    </div>
  );
};

export default ProfileResumeSubView;
