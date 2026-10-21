import React from 'react';
import { ReportingView, SubReportTab } from './reports/ReportingView';
import { useProject } from '../context/ProjectContext';

export const DepartmentTechnicalView: React.FC = () => {
  const { activeSubTab, setActiveSubTab } = useProject();

  const validTabs: SubReportTab[] = ['analytics', 'roadmap', 'bottlenecks', 'timeline'];
  const initialSubTab: SubReportTab = validTabs.includes(activeSubTab as SubReportTab)
    ? (activeSubTab as SubReportTab)
    : 'analytics';

  return (
    <ReportingView
      initialSubTab={initialSubTab}
      onSubTabChange={(tab) => setActiveSubTab(tab)}
    />
  );
};

export default DepartmentTechnicalView;

