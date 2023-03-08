import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './app.css';
import App from './App.svelte';

gsap.registerPlugin(ScrollTrigger);

const app = new App({
  target: document.getElementById('app'),
});

export default app;
