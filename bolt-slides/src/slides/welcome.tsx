import Slide from '@/deck/Slide';
import Reveal from '@/deck/Reveal';
import type { SlideComponent } from '@/slide/registry';

/* Seed slide. Delete this file once the deck has its own slides. */
const Welcome: SlideComponent = () => (
  <Slide center>
    <Reveal>
      <div className="kicker" style={{ marginBottom: 'clamp(12px, 2vh, 20px)' }}>
        Bolt Slides
      </div>
      <h1 className="display">
        Your deck <span className="accent-text">starts here.</span>
      </h1>
      <p className="subhead" style={{ marginTop: 'clamp(14px, 2.5vh, 24px)' }}>
        Ask Bolt for a deck. Every slide becomes a React component in
        src/slides/, listed in deck.json.
      </p>
    </Reveal>
  </Slide>
);

export default Welcome;
