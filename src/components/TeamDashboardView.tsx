import {MessagesView} from './chat/MessagesView';
import React from 'react';
import { useProject } from '../context/ProjectContext';
import { Users } from 'lucide-react';
import { iconByName } from '../lib/icons';

interface TeamDashboardViewProps {
  teamId: string;
  deptId: string;
}

export const TeamDashboardView: React.FC<TeamDashboardViewProps> = ({ teamId, deptId }) => {
  const {teams,departments,chatUsers}=useProject();
  const team = teams.find((t: any) => t.id === teamId);
  const dept = departments.find((d: any) => d.id === deptId);

  const renderIcon = (name: string, size = 16, className = "") => {
    const IconComp = iconByName(name, Users);
    return <IconComp size={size} className={className} />;
  };

  if (!team) return <div className="text-center py-12 text-xs text-text-secondary">تیم مورد نظر یافت نشد</div>;
  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 text-start">
      {/* Right Column: Team Meta & Members (1/3 width) */}
      <div className="space-y-6">
        {/* Team Details */}
        <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-black text-white" style={{ backgroundColor: team.color || '#6C63FF' }}>
              {team.avatar || team.name.substring(0, 1)}
            </div>
            <div>
              <span className="text-[10px] bg-[#6C63FF]/15 text-[#6C63FF] px-2 py-0.5 rounded-full font-bold">
                {dept?.name || 'بدون دپارتمان'}
              </span>
              <h2 className="text-sm font-black text-text-primary mt-1">{team.name}</h2>
            </div>
          </div>

          {team.description && (
            <p className="text-xs text-text-secondary leading-relaxed bg-hover-overlay p-3 rounded-lg">
              {team.description}
            </p>
          )}

          <div className="pt-3 border-t border-border-primary/50 text-[10.5px] text-text-secondary space-y-2">
            <div className="flex justify-between">
              <span>تعداد اعضا:</span>
              <span className="text-text-primary">{((team as any).memberIds || []).length.toLocaleString('fa-IR')}</span>
            </div>
          </div>
        </div>

        {/* Team Members List */}
        <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-black text-text-primary flex items-center gap-1.5 border-b border-border-primary/50 pb-2.5">
            {renderIcon('Users', 14)}
            متخصصین و پرسنل این تیم
          </h3>

          <div className="space-y-2.5">
            {chatUsers.filter((user:any)=>(user.teams||[]).some((item:any)=>(typeof item==='string'?item:item.id)===teamId)||user.teamId===teamId).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between hover:bg-hover-overlay/40 p-1.5 rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-hover-overlay text-text-primary font-bold flex items-center justify-center text-xs">
                    {m.name.substring(0, 1)}
                  </div>
                  <div>
                    <h4 className="text-[11.5px] font-bold text-text-primary">{m.name}</h4>
                    <p className="text-[9.5px] text-[#6C63FF] font-bold mt-0.5">عضو تیم</p>
                  </div>
                </div>

                <span className="flex h-2 w-2 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${m.status === 'online' ? 'bg-brand-success' : 'bg-text-secondary/50'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${m.status === 'online' ? 'bg-brand-success' : 'bg-text-secondary/50'}`}></span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Left Column: Team Chat & Channels (2/3 width) */}
      <div className="lg:col-span-2 min-w-0"><MessagesView teamId={teamId}/></div>
    </div>
  );
};
