/* The freeform 'canvas' layout — free positioning with snap guides.
   All real logic lives in src/edit/FreeformEditor.tsx; items are percent-
   positioned so editor / present / thumbnails / PDF render identically.
   No inspector field schema: items are edited directly on the canvas. */
import Slide from '@/deck/Slide'
import FreeformCanvas from '@/edit/FreeformEditor'
import { type LayoutDef } from '@/layouts/shared'

export const freeformLayouts: LayoutDef[] = [
  {
    type: 'canvas',
    label: 'Freeform',
    hint: 'Blank canvas — place, resize and snap anything',
    defaults: {
      items: [
        { type: 'image', x: 58, y: 16, w: 34, h: 68, url: '', radius: 18 },
        { type: 'text', x: 8, y: 28, w: 44, h: 18, font: 'head', text: '{s:2.1}Arrange it ==your way=={/s}' },
        { type: 'box', x: 8, y: 48, w: 10, h: 1.2, bg: 'var(--accent)', radius: 2 },
        { type: 'text', x: 8, y: 54, w: 40, h: 14, font: 'body', text: '{s:0.8}Drag, resize and snap text, images and shapes anywhere on the slide.{/s}' },
      ],
    },
    fields: [],
    Render: ({ slide }) => (
      <Slide full>
        <FreeformCanvas slide={slide} />
      </Slide>
    ),
  },
]
