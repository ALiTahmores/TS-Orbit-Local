import React from 'react';
import {useProject} from '../../context/ProjectContext';
import {AssetManager} from '../assets/AssetManager';
export const ProjectFilesTab:React.FC<{title?:string}>=({title})=>{const {selectedProject}=useProject();return selectedProject?.id&&selectedProject.id!=='no_project'?<AssetManager key={selectedProject.id} projectId={selectedProject.id} title={title}/>:<p className="text-xs text-slate-500 dark:text-slate-400 p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">ابتدا یک پروژه انتخاب کنید.</p>;};
