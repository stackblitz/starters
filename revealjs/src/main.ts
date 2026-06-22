import Reveal from 'reveal.js';
import RevealNotes from 'reveal.js/plugin/notes';

import 'reveal.js/reset.css';
import 'reveal.js/reveal.css';
import 'reveal.js/theme/black.css';

const deck = new Reveal({
  hash: true,
  slideNumber: true,
  plugins: [RevealNotes],
});

void deck.initialize();
