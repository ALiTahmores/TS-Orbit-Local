import {PersonalActivitiesView} from './personal/PersonalActivitiesView';
import {MyFilesSubView} from './personal/MyFilesSubView';
import React from 'react';
import { useProject } from '../context/ProjectContext';
import { MyDashboardSubView } from './personal/MyDashboardSubView';
import { MyProjectsSubView } from './personal/MyProjectsSubView';
import { MyTasksSubView } from './personal/MyTasksSubView';
import { MessagesSubView } from './personal/MessagesSubView';
import { PerformanceSubView } from './personal/PerformanceSubView';
import { ProfileResumeSubView } from './personal/ProfileResumeSubView';

export const PersonalTasksView: React.FC = () => {
  const { activeSubTab } = useProject();

  switch (activeSubTab) {
    case 'my_dashboard':
    case 'my-dashboard':
    case 'overview':
      return <MyDashboardSubView />;
    case 'my_projects':
    case 'my-projects':
      return <MyProjectsSubView />;
    case 'activity-feed':
    case 'my-activities': return <PersonalActivitiesView/>;
    case 'my-files':
    case 'my_files': return <MyFilesSubView/>;
    case 'my_tasks':
    case 'my-tasks':
      return <MyTasksSubView />;
    case 'messages':
    case 'pv-messages':
      return <MessagesSubView />;
    case 'performance':
    case 'performance-score':
      return <PerformanceSubView />;
    case 'profile':
    case 'resume-profile':
      return <ProfileResumeSubView />;
    default:
      return <MyDashboardSubView />;
  }
};

