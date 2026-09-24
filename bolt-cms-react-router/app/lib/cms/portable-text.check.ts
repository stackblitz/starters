/** `npm run check` — asserts the Portable Text converters round-trip editor output. */
import assert from 'node:assert/strict';

import {
  portableTextToHtml,
  proseMirrorToPortableText,
  type PortableTextTextBlock,
} from './portable-text.ts';

const toHtml = (node: { type?: string }) => `<${node.type}-html>`;

// (a) heading, paragraph with bold + link, bullet list of two, image
const blocks = proseMirrorToPortableText(
  {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Title' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          {
            type: 'text',
            text: ' link',
            marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
          },
        ],
      },
      {
        type: 'bulletList',
        content: ['one', 'two'].map((text) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        })),
      },
      { type: 'image', attrs: { src: 'https://example.com/a.jpg', alt: 'A' } },
    ],
  },
  toHtml
);

const [heading, paragraph, first, second] = blocks.slice(
  0,
  4
) as PortableTextTextBlock[];
assert.equal(blocks.length, 5);
assert.equal(heading.style, 'h2');
assert.deepEqual(paragraph.children[1].marks, ['strong']);
assert.equal(paragraph.markDefs.length, 1);
assert.equal(paragraph.markDefs[0].href, 'https://example.com');
assert.deepEqual(paragraph.children[2].marks, [paragraph.markDefs[0]._key]);
assert.equal(first.listItem, 'bullet');
assert.equal(first.level, 1);
assert.equal(second.listItem, 'bullet');
assert.equal(blocks[4]._type, 'image');

const html = portableTextToHtml(blocks);
assert.match(html, /<h2>Title<\/h2>/);
assert.match(html, /<strong>bold<\/strong>/);
assert.match(html, /<a href="https:\/\/example.com"> link<\/a>/);
assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
assert.match(html, /<figure><img src="https:\/\/example.com\/a.jpg" alt="A">/);

// (b) unknown block nodes go through the injected serializer
const [table] = proseMirrorToPortableText(
  { type: 'doc', content: [{ type: 'table', content: [] }] },
  toHtml
);
assert.ok(table._type === 'html' && table.html === '<table-html>');

// (c) span text is escaped
const escaped = portableTextToHtml([
  {
    _type: 'block',
    _key: 'k',
    style: 'normal',
    markDefs: [],
    children: [
      {
        _type: 'span',
        _key: 's',
        text: '<script>alert(1)</script>',
        marks: [],
      },
    ],
  },
]);
assert.equal(escaped, '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');

console.log('portable-text: ok');
