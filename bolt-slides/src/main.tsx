import React from 'react';
import ReactDOM from 'react-dom/client';
import StudioApp from './studio/StudioApp';
import './styles/tokens.css';
import './styles/chrome-tokens.css';
import './styles/base.css';
import './styles/chrome.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StudioApp />
  </React.StrictMode>
);
