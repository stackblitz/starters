/**
 * Portable Text ⇄ HTML / ProseMirror, matching the blocks Bolt's WordPress
 * importer writes.
 * Dependency-free so `npm run check` can run it with plain Node.
 */
import type { JSONContent } from '@tiptap/core';

export interface PortableTextSpan {
  _type: 'span';
  _key: string;
  text: string;
  marks: string[];
}

export interface PortableTextLinkMarkDef {
  _type: 'link';
  _key: string;
  href: string;
}

export type PortableTextStyle =
  | 'normal'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'blockquote';

export interface PortableTextTextBlock {
  _type: 'block';
  _key: string;
  style: PortableTextStyle;
  children: PortableTextSpan[];
  markDefs: PortableTextLinkMarkDef[];
  listItem?: 'bullet' | 'number';
  level?: number;
}

export interface PortableTextImage {
  _type: 'image';
  _key: string;
  url: string;
  asset?: { _type: 'reference'; _ref: string };
  alt?: string;
  caption?: string;
}

export interface PortableTextEmbed {
  _type: 'embed';
  _key: string;
  url: string;
}

export interface PortableTextHtml {
  _type: 'html';
  _key: string;
  html: string;
}

export type PortableTextBlock =
  | PortableTextTextBlock
  | PortableTextImage
  | PortableTextEmbed
  | PortableTextHtml;

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const SIMPLE_MARKS: Record<string, string> = {
  strong: 'strong',
  em: 'em',
  code: 'code',
  underline: 'u',
  'strike-through': 's',
};

function spansToHtml(block: PortableTextTextBlock) {
  return block.children
    .map((span) => {
      let html = escape(span.text).replace(/\n/g, '<br>');
      for (const mark of span.marks) {
        const tag = SIMPLE_MARKS[mark];
        if (tag) {
          html = `<${tag}>${html}</${tag}>`;
          continue;
        }
        const link = block.markDefs.find(
          (def) => def._key === mark && def._type === 'link'
        );
        if (link) html = `<a href="${escape(link.href)}">${html}</a>`;
      }
      return html;
    })
    .join('');
}

export function portableTextToHtml(blocks: PortableTextBlock[]): string {
  const out: string[] = [];
  let openList: 'bullet' | 'number' | null = null;

  const closeList = () => {
    if (openList) out.push(openList === 'bullet' ? '</ul>' : '</ol>');
    openList = null;
  };

  for (const block of blocks) {
    if (block._type === 'block' && block.listItem) {
      if (openList !== block.listItem) {
        closeList();
        openList = block.listItem;
        out.push(openList === 'bullet' ? '<ul>' : '<ol>');
      }
      // ponytail: nested `level`s render flat; nest lists if imported content needs it
      out.push(`<li>${spansToHtml(block)}</li>`);
      continue;
    }
    closeList();

    switch (block._type) {
      case 'block': {
        const inner = spansToHtml(block);
        if (block.style === 'blockquote')
          out.push(`<blockquote><p>${inner}</p></blockquote>`);
        else if (block.style === 'normal') out.push(`<p>${inner}</p>`);
        else out.push(`<${block.style}>${inner}</${block.style}>`);
        break;
      }
      case 'image': {
        const caption = block.caption
          ? `<figcaption>${escape(block.caption)}</figcaption>`
          : '';
        out.push(
          `<figure><img src="${escape(block.url)}" alt="${escape(
            block.alt ?? ''
          )}">${caption}</figure>`
        );
        break;
      }
      case 'embed':
        out.push(
          `<iframe src="${escape(
            block.url
          )}" allowfullscreen loading="lazy"></iframe>`
        );
        break;
      case 'html':
        // sanitized downstream (PostContent)
        out.push(block.html);
        break;
    }
  }
  closeList();

  return out.join('');
}

const newKey = () => crypto.randomUUID().slice(0, 8);

const PM_MARKS: Record<string, string> = {
  bold: 'strong',
  italic: 'em',
  code: 'code',
  underline: 'underline',
  strike: 'strike-through',
};

function textBlock(
  node: JSONContent,
  style: PortableTextStyle,
  extra: Pick<PortableTextTextBlock, 'listItem' | 'level'> = {}
): PortableTextTextBlock {
  const block: PortableTextTextBlock = {
    _type: 'block',
    _key: newKey(),
    style,
    children: [],
    markDefs: [],
    ...extra,
  };

  for (const child of node.content ?? []) {
    if (child.type === 'hardBreak') {
      const last = block.children.at(-1);
      if (last) last.text += '\n';
      else
        block.children.push({
          _type: 'span',
          _key: newKey(),
          text: '\n',
          marks: [],
        });
      continue;
    }
    if (child.type !== 'text') continue;

    const marks: string[] = [];
    for (const mark of child.marks ?? []) {
      if (mark.type === 'link') {
        const href = String(mark.attrs?.href ?? '');
        let def = block.markDefs.find((d) => d.href === href);
        if (!def) {
          def = { _type: 'link', _key: newKey(), href };
          block.markDefs.push(def);
        }
        marks.push(def._key);
      } else if (PM_MARKS[mark.type]) {
        marks.push(PM_MARKS[mark.type]);
      }
    }
    block.children.push({
      _type: 'span',
      _key: newKey(),
      text: child.text ?? '',
      marks,
    });
  }

  return block;
}

const plainText = (node: JSONContent): string =>
  node.type === 'text'
    ? node.text ?? ''
    : (node.content ?? []).map(plainText).join('');

export function proseMirrorToPortableText(
  doc: JSONContent,
  toHtml: (node: JSONContent) => string
): PortableTextBlock[] {
  const blocks: PortableTextBlock[] = [];

  const list = (
    node: JSONContent,
    listItem: 'bullet' | 'number',
    level: number
  ) => {
    for (const item of node.content ?? []) {
      for (const child of item.content ?? []) {
        if (child.type === 'bulletList') list(child, 'bullet', level + 1);
        else if (child.type === 'orderedList') list(child, 'number', level + 1);
        else blocks.push(textBlock(child, 'normal', { listItem, level }));
      }
    }
  };

  for (const node of doc.content ?? []) {
    switch (node.type) {
      case 'paragraph':
        blocks.push(textBlock(node, 'normal'));
        break;
      case 'heading':
        blocks.push(
          textBlock(node, `h${node.attrs?.level ?? 2}` as PortableTextStyle)
        );
        break;
      case 'blockquote':
        for (const child of node.content ?? [])
          blocks.push(textBlock(child, 'blockquote'));
        break;
      case 'bulletList':
        list(node, 'bullet', 1);
        break;
      case 'orderedList':
        list(node, 'number', 1);
        break;
      case 'codeBlock':
        blocks.push({
          _type: 'block',
          _key: newKey(),
          style: 'normal',
          markDefs: [],
          children: [
            {
              _type: 'span',
              _key: newKey(),
              text: plainText(node),
              marks: ['code'],
            },
          ],
        });
        break;
      case 'image':
        blocks.push({
          _type: 'image',
          _key: newKey(),
          url: String(node.attrs?.src ?? ''),
          alt: node.attrs?.alt || undefined,
          caption: node.attrs?.title || undefined,
        });
        break;
      case 'youtube':
        blocks.push({
          _type: 'embed',
          _key: newKey(),
          url: String(node.attrs?.src ?? ''),
        });
        break;
      case 'horizontalRule':
        blocks.push({ _type: 'html', _key: newKey(), html: '<hr>' });
        break;
      default:
        blocks.push({ _type: 'html', _key: newKey(), html: toHtml(node) });
    }
  }

  return blocks;
}
