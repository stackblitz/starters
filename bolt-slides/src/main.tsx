import React from 'react';
import ReactDOM from 'react-dom/client';
import EditorApp from './edit/EditorApp';
import './styles/tokens.css';
import './styles/chrome-tokens.css';
import './styles/base.css';
import './styles/editor.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EditorApp />
  </React.StrictMode>
);
