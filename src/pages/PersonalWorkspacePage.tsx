import React from 'react';
import { PersonalTasksView } from '../components/PersonalTasksView';

export const PersonalWorkspacePage: React.FC = () => {
  return (
    <div className="w-full h-full">
      <PersonalTasksView />
    </div>
  );
};

export default PersonalWorkspacePage;
