import React from 'react';
import { DepartmentReportsView } from './DepartmentReportsView';

export interface AgencyReportingViewProps {
  deptId?: string;
}

export const AgencyReportingView: React.FC<AgencyReportingViewProps> = (props) => {
  return <DepartmentReportsView {...props} />;
};

export default AgencyReportingView;
