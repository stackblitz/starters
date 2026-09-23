/**
 * Tiptap-based rich text editor.
 *
 * Opens from the post's Portable Text `body` (or the imported `content_html`
 * when there is no body) and emits both on change: Portable Text is what the
 * site renders, HTML is the fallback copy stored in `content_html`.
 */
import { generateHTML } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import Youtube from '@tiptap/extension-youtube';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code,
  Code2,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Table as TableIcon,
  Undo,
  Video as VideoIcon,
} from 'lucide-react';
import { useState } from 'react';

import { assetUrl } from '@/lib/cms/media';
import {
  portableTextToHtml,
  proseMirrorToPortableText,
  type PortableTextBlock,
} from '@/lib/cms/portable-text';
import type { Asset } from '@/lib/cms/types';

import { MediaPicker } from '../MediaPicker';
import { Button, cx, Input, Textarea } from '../ui';

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
  Image.configure({
    inline: false,
    allowBase64: false,
    HTMLAttributes: { loading: 'lazy' },
  }),
  TableKit.configure({ table: { resizable: false } }),
  Youtube.configure({ nocookie: true, width: 640, height: 360 }),
  Placeholder.configure({ placeholder: 'Start writing…' }),
];

/** Initial content is read once; remount (`key`) to load another document. */
export function RichTextEditor({
  initialBody,
  initialHtml,
  onChange,
}: {
  initialBody: PortableTextBlock[] | null;
  initialHtml: string | null;
  onChange: (value: { body: PortableTextBlock[]; html: string }) => void;
}) {
  const [initial] = useState(() =>
    initialBody?.length ? portableTextToHtml(initialBody) : initialHtml ?? ''
  );
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [pickImage, setPickImage] = useState(false);
  const [source, setSource] = useState(initial);

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initial,
    editorProps: {
      attributes: {
        class:
          'entry-content admin-editor min-h-[24rem] px-5 py-4 focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setSource(html);
      onChange({
        body: proseMirrorToPortableText(editor.getJSON(), (node) =>
          generateHTML({ type: 'doc', content: [node] }, extensions)
        ),
        html,
      });
    },
  });

  function applySource() {
    if (!editor) return;
    editor.commands.setContent(source, { emitUpdate: true });
    setMode('visual');
  }

  function insertAsset(asset: Asset) {
    const url = assetUrl(asset);
    setPickImage(false);
    if (!url || !editor) return;
    editor
      .chain()
      .focus()
      .setImage({
        src: url,
        alt: asset.alt ?? '',
        title: asset.caption ?? undefined,
      })
      .run();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-bolt-ds-borderPrimary bg-bolt-ds-bg">
      <Toolbar
        editor={editor}
        mode={mode}
        onMode={setMode}
        onImage={() => setPickImage(true)}
      />
      {mode === 'visual' ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="p-3">
          <Textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            className="min-h-[24rem] font-mono text-xs leading-relaxed"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode('visual')}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={applySource}>
              Apply HTML
            </Button>
          </div>
        </div>
      )}
      <MediaPicker
        open={pickImage}
        onClose={() => setPickImage(false)}
        onSelect={insertAsset}
      />
    </div>
  );
}

function Toolbar({
  editor,
  mode,
  onMode,
  onImage,
}: {
  editor: Editor | null;
  mode: 'visual' | 'html';
  onMode: (mode: 'visual' | 'html') => void;
  onImage: () => void;
}) {
  const disabled = !editor || mode === 'html';
  // Inline URL entry: the Bolt sandbox blocks native prompt dialogs.
  const [draft, setDraft] = useState<{
    kind: 'link' | 'youtube';
    url: string;
  } | null>(null);

  const applyDraft = () => {
    if (!editor || !draft) return;
    const url = draft.url.trim();
    setDraft(null);
    if (draft.kind === 'youtube') {
      if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
    } else if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url })
        .run();
    }
  };

  const items: Array<
    | {
        icon: React.ReactNode;
        label: string;
        run: () => void;
        active?: boolean;
      }
    | 'sep'
  > = editor
    ? [
        {
          icon: <Undo size={14} />,
          label: 'Undo',
          run: () => editor.chain().focus().undo().run(),
        },
        {
          icon: <Redo size={14} />,
          label: 'Redo',
          run: () => editor.chain().focus().redo().run(),
        },
        'sep',
        {
          icon: <Heading2 size={14} />,
          label: 'Heading 2',
          run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          active: editor.isActive('heading', { level: 2 }),
        },
        {
          icon: <Heading3 size={14} />,
          label: 'Heading 3',
          run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          active: editor.isActive('heading', { level: 3 }),
        },
        'sep',
        {
          icon: <Bold size={14} />,
          label: 'Bold',
          run: () => editor.chain().focus().toggleBold().run(),
          active: editor.isActive('bold'),
        },
        {
          icon: <Italic size={14} />,
          label: 'Italic',
          run: () => editor.chain().focus().toggleItalic().run(),
          active: editor.isActive('italic'),
        },
        {
          icon: <Strikethrough size={14} />,
          label: 'Strike',
          run: () => editor.chain().focus().toggleStrike().run(),
          active: editor.isActive('strike'),
        },
        {
          icon: <Code size={14} />,
          label: 'Inline code',
          run: () => editor.chain().focus().toggleCode().run(),
          active: editor.isActive('code'),
        },
        {
          icon: <LinkIcon size={14} />,
          label: 'Link',
          run: () =>
            setDraft({
              kind: 'link',
              url:
                (editor.getAttributes('link').href as string | undefined) ??
                'https://',
            }),
          active: editor.isActive('link'),
        },
        'sep',
        {
          icon: <List size={14} />,
          label: 'Bullet list',
          run: () => editor.chain().focus().toggleBulletList().run(),
          active: editor.isActive('bulletList'),
        },
        {
          icon: <ListOrdered size={14} />,
          label: 'Numbered list',
          run: () => editor.chain().focus().toggleOrderedList().run(),
          active: editor.isActive('orderedList'),
        },
        {
          icon: <Quote size={14} />,
          label: 'Quote',
          run: () => editor.chain().focus().toggleBlockquote().run(),
          active: editor.isActive('blockquote'),
        },
        {
          icon: <Code2 size={14} />,
          label: 'Code block',
          run: () => editor.chain().focus().toggleCodeBlock().run(),
          active: editor.isActive('codeBlock'),
        },
        {
          icon: <Minus size={14} />,
          label: 'Divider',
          run: () => editor.chain().focus().setHorizontalRule().run(),
        },
        'sep',
        { icon: <ImageIcon size={14} />, label: 'Image', run: onImage },
        {
          icon: <VideoIcon size={14} />,
          label: 'YouTube',
          run: () => setDraft({ kind: 'youtube', url: '' }),
        },
        {
          icon: <TableIcon size={14} />,
          label: 'Table',
          run: () =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run(),
          active: editor.isActive('table'),
        },
      ]
    : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-bolt-ds-borderSecondary bg-bolt-ds-bgSecondary px-2 py-1">
        {items.map((item, i) =>
          item === 'sep' ? (
            <span
              key={`sep-${i}`}
              className="mx-1 h-4 w-px bg-bolt-ds-borderPrimary"
            />
          ) : (
            <button
              key={item.label}
              type="button"
              title={item.label}
              aria-label={item.label}
              disabled={disabled}
              onClick={item.run}
              className={cx(
                'inline-flex h-7 w-7 items-center justify-center rounded text-bolt-ds-iconSecondary hover:bg-bolt-ds-utilHover hover:text-bolt-ds-textPrimary disabled:opacity-40',
                item.active && 'bg-bolt-ds-bgTertiary text-bolt-ds-textPrimary'
              )}
            >
              {item.icon}
            </button>
          )
        )}
        <div className="ml-auto flex items-center gap-0.5 text-xs">
          <ModeButton
            active={mode === 'visual'}
            onClick={() => onMode('visual')}
          >
            Visual
          </ModeButton>
          <ModeButton active={mode === 'html'} onClick={() => onMode('html')}>
            HTML
          </ModeButton>
        </div>
      </div>
      {draft && (
        <div className="flex items-center gap-2 border-b border-bolt-ds-borderSecondary bg-bolt-ds-bgSecondary px-2 py-1.5">
          <Input
            autoFocus
            value={draft.url}
            placeholder={
              draft.kind === 'link'
                ? 'https://… (empty removes the link)'
                : 'YouTube URL'
            }
            aria-label={draft.kind === 'link' ? 'Link URL' : 'YouTube URL'}
            className="h-7 py-1 text-xs"
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyDraft();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setDraft(null);
              }
            }}
          />
          <Button size="sm" variant="primary" onClick={applyDraft}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
            Cancel
          </Button>
        </div>
      )}
    </>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded px-2 py-1 text-bolt-ds-textTertiary hover:text-bolt-ds-textPrimary',
        active && 'bg-bolt-ds-bgTertiary text-bolt-ds-textPrimary'
      )}
    >
      {children}
    </button>
  );
}
