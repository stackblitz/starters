import React from 'react';
import ReactDOM from 'react-dom/client';
import EditorApp from './edit/EditorApp';
import PresentApp from './present/PresentApp';
import './styles/tokens.css';
import './styles/chrome-tokens.css';
import './styles/base.css';
import './styles/editor.css';

/*  /          the editor in the Bolt preview iframe; on the published
               origin this is the audience deck (no notes)
               Present from the editor swaps this view in place
    /present   presenter console and leftover present share links */
const isPresent = window.location.pathname.startsWith('/present');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPresent ? <PresentApp /> : <EditorApp />}
  </React.StrictMode>
);
