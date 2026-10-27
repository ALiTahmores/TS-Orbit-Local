import {
  Activity, AlertTriangle, Award, BarChart, BarChart3, Bell, BookOpen, Box, Building2, Calendar, Check, CheckCircle,
  CheckSquare, Chrome, CircleDollarSign, Code, Compass, Cpu, Database, Delete, Download, Edit, Edit3, Eye, Figma, File,
  FileText, Files, Film, Folder, FolderGit, FolderGit2, FolderKanban, FolderOpen, GitBranch, GitMerge, Grid, History,
  Home, Kanban, Key, Layers, Layout, LayoutDashboard, LayoutGrid, LineChart, Lock, Megaphone, Menu, MessageSquare,
  Network, Palette, PenTool, Phone, PieChart, Plus, PlusCircle, Rocket, Save, Search, Send, Server, Settings, Settings2,
  Share2, Shield, ShieldCheck, ShoppingBag, Sliders, Smartphone, Sparkles, Sun, Tablet, Tags, Target, Terminal, Trash2,
  Trello, TrendingUp, Trophy, User, UserCheck, UserCheck2, UserPlus, Users, Video, Workflow, Zap,
  type LucideIcon,
} from 'lucide-react';

// Navigation groups, modules, departments and teams persist their icon by name.
// Resolving names through `import * as` pulled every lucide icon into the bundle,
// so lookups go through this registry: every name the pickers, presets and server
// defaults can store. Add a name here when a picker starts offering it.
const iconsByName: Record<string, LucideIcon> = {
  Activity, AlertTriangle, Award, BarChart, BarChart3, Bell, BookOpen, Box, Building2, Calendar, Check, CheckCircle,
  CheckSquare, Chrome, CircleDollarSign, Code, Compass, Cpu, Database, Delete, Download, Edit, Edit3, Eye, Figma, File,
  FileText, Files, Film, Folder, FolderGit, FolderGit2, FolderKanban, FolderOpen, GitBranch, GitMerge, Grid, History,
  Home, Kanban, Key, Layers, Layout, LayoutDashboard, LayoutGrid, LineChart, Lock, Megaphone, Menu, MessageSquare,
  Network, Palette, PenTool, Phone, PieChart, Plus, PlusCircle, Rocket, Save, Search, Send, Server, Settings, Settings2,
  Share2, Shield, ShieldCheck, ShoppingBag, Sliders, Smartphone, Sparkles, Sun, Tablet, Tags, Target, Terminal, Trash2,
  Trello, TrendingUp, Trophy, User, UserCheck, UserCheck2, UserPlus, Users, Video, Workflow, Zap,
};

export function iconByName(name: string | undefined | null, fallback: LucideIcon): LucideIcon {
  return (name && Object.hasOwn(iconsByName, name) && iconsByName[name]) || fallback;
}
