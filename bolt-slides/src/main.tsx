import React from 'react';
import ReactDOM from 'react-dom/client';
import EditorApp from './edit/EditorApp';
import './styles/tokens.css';
import './styles/chrome-tokens.css';
import './styles/base.css';
import './styles/editor.css';

/*  /          studio in the Bolt preview iframe (and local Vite); on the
               published origin this is the audience deck (no notes)
               Present from the studio swaps this view in place
    /present   presenter console (`?presenter=1` also) */

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EditorApp />
  </React.StrictMode>
);
