import React from 'react';
import { Task } from '../../types';
import { TaskFullManageView } from './TaskFullManageView';
export interface TaskFullDetailViewProps { task:Task; onBack:()=>void; }
export const TaskFullDetailView:React.FC<TaskFullDetailViewProps> = ({task,onBack}) => <TaskFullManageView key={task.id} taskId={task.id} onBack={onBack}/>;
