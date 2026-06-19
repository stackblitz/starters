# reveal.js + TypeScript starter

A barebones [reveal.js](https://revealjs.com) presentation, wired up with TypeScript and Vite.

To start the slide show:

- `npm install`
- `npm run dev`
- visit http://localhost:5173

## Editing your deck

- **Slides** live in [index.html](./index.html) as `<section>` elements inside `.slides`.
  - Nest `<section>` elements for vertical slides.
  - Add the `fragment` class to reveal content incrementally.
  - Add `<aside class="notes">` for speaker notes (press <kbd>S</kbd>).
- **Configuration** and plugins live in [src/main.ts](./src/main.ts).

## Themes

Swap the theme import in `src/main.ts` for any built-in theme, e.g.:

```ts
import 'reveal.js/theme/white.css';
```

## Building

- `npm run build` — type-check and bundle to `dist/`
- `npm run preview` — preview the production build

Learn more in the [reveal.js documentation](https://revealjs.com).
