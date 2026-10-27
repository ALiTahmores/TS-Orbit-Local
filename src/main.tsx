import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {installChunkRecovery} from './lib/lazy';
import {installDialogKeyboard} from './lib/dialogKeyboard';
import {translateNativeDialogs} from './lib/domTranslation';
import './index.css';

installChunkRecovery();
installDialogKeyboard();
translateNativeDialogs();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
