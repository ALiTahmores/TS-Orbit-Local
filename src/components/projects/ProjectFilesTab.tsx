import React from 'react';
import {useProject} from '../../context/ProjectContext';
import {AssetManager} from '../assets/AssetManager';
export const ProjectFilesTab:React.FC=()=>{const {selectedProject}=useProject();return selectedProject?.id&&selectedProject.id!=='no_project'?<AssetManager key={selectedProject.id} projectId={selectedProject.id}/>:<p>ابتدا یک پروژه انتخاب کنید.</p>;};
