import type { SlideComponent } from '@/slide/registry';

/* Seed slide. It has no design on purpose — delete it once the deck has
   its own slides. */
const Welcome: SlideComponent = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'grid',
      placeItems: 'center',
      padding: 'clamp(24px, 6cqw, 96px)',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}
  >
    <div>
      <h1 style={{ fontSize: 'clamp(28px, 5cqw, 64px)', fontWeight: 600 }}>
        Your deck starts here.
      </h1>
      <p
        style={{
          marginTop: '1em',
          fontSize: 'clamp(15px, 1.8cqw, 22px)',
          opacity: 0.7,
          maxWidth: '40ch',
          marginInline: 'auto',
        }}
      >
        Ask Bolt for a deck. Every slide becomes a React component in
        src/slides/, listed in deck.json.
      </p>
    </div>
  </div>
);

export default Welcome;
