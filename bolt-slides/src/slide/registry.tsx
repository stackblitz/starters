import type { ComponentType } from 'react';
import type { SlideData } from '../data/types';

/** A slide component: `src/slides/<name>.tsx`, default export. */
export type SlideComponent = ComponentType<{ slide: SlideData }>;

/* Every file in src/slides/ is a slide component; its basename is the
   `layout` value that deck.json uses to reference it. */
const modules = import.meta.glob<SlideComponent>('../slides/*.tsx', {
  eager: true,
  import: 'default',
});

export const SLIDES: Record<string, SlideComponent> = Object.fromEntries(
  Object.entries(modules).map(([file, component]) => [
    file.replace(/^.*\//, '').replace(/\.tsx$/, ''),
    component,
  ])
);

/** Human label for a slide name: `closing-cta` / `closingCta` → "Closing cta". */
export function slideLabel(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();

  return words ? words[0].toUpperCase() + words.slice(1) : 'Slide';
}

export function RenderSlide({ slide }: { slide: SlideData }) {
  const name = String(slide.layout ?? '').trim();
  const Component = SLIDES[name];

  if (!Component) {
    return (
      <div className="slide center">
        <div className="kicker" style={{ marginBottom: 12 }}>
          Missing slide component
        </div>
        <h2 className="headline">“{name || '(empty)'}”</h2>
        <p className="subhead" style={{ marginTop: 16 }}>
          Add <code>src/slides/{name || 'name'}.tsx</code> with a default
          export, or point this deck.json entry at an existing file.
        </p>
      </div>
    );
  }

  return <Component slide={slide} />;
}
