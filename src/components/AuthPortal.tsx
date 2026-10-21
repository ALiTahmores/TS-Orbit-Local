import React, {useState,useEffect} from 'react';
import { AuthModal } from './auth/AuthModal';

export const AuthPortal: React.FC = () => {
  const [notice]=useState(()=>sessionStorage.getItem('orbit_auth_notice') || '');
  useEffect(()=>{sessionStorage.removeItem('orbit_auth_notice');},[]);
  return <AuthModal isOpen={true} initialNotice={notice} />;
};

export default AuthPortal;
