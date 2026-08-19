import React from 'react';
import ReactDOM from 'react-dom/client';
import EditorApp from '@/edit/EditorApp';
import PresentApp from '@/present/PresentApp';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/editor.css';

/*  /          the editor (Pitch-style: sidebar · canvas · inspector)
    /present   full-screen presentation of the same deck  */
const isPresent = window.location.pathname.startsWith('/present');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPresent ? <PresentApp /> : <EditorApp />}
  </React.StrictMode>
);
