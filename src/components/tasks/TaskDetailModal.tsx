import React from 'react';
import { Task } from '../../types';
import { TaskQuickDetailModal } from './TaskQuickDetailModal';
export interface TaskDetailModalProps {task:Task|null;isOpen:boolean;onClose:()=>void;onOpenFull?:()=>void;onOpenFullManage?:(id:string)=>void;}
export const TaskDetailModal:React.FC<TaskDetailModalProps> = ({task,isOpen,onClose,onOpenFull,onOpenFullManage}) => <TaskQuickDetailModal task={task} isOpen={isOpen} onClose={onClose} onOpenFullManage={onOpenFull ? ()=>{onClose();onOpenFull();} : onOpenFullManage}/>;
