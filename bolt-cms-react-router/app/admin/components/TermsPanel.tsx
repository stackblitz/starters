import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { COLLECTIONS, insertCollection } from '@/admin/api';
import { errorMessage, isRejectedByUser } from '@/admin/hooks';
import { slugify } from '@/lib/cms/format';
import type { Term } from '@/lib/cms/types';

import { Button, Card, Checkbox, Input, useToast } from './ui';

/**
 * Category checklist (hierarchical) or tag chips, bound to a `bigint[]` of ids.
 * New terms are created immediately so their ids exist when the post saves.
 */
export function TermsPanel({
  kind,
  terms,
  selected,
  onChange,
  onCreated,
  disabled,
}: {
  kind: 'category' | 'tag';
  terms: Term[];
  selected: number[];
  onChange: (ids: number[]) => void;
  onCreated?: (term: Term) => void;
  disabled?: boolean;
}) {
  const { label, singular } = COLLECTIONS[kind];
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const toast = useToast();

  async function create(name: string) {
    const clean = name.trim();
    if (!clean) return;
    const existing = terms.find(
      (t) => t.name.toLowerCase() === clean.toLowerCase()
    );
    if (existing) {
      if (!selected.includes(existing.id)) onChange([...selected, existing.id]);
      setDraft('');
      return;
    }
    setAdding(true);
    try {
      const term = await insertCollection(kind, {
        name: clean,
        slug: slugify(clean),
      });
      onCreated?.(term);
      onChange([...selected, term.id]);
      setDraft('');
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    } finally {
      setAdding(false);
    }
  }

  if (kind === 'tag') {
    const chosen = terms.filter((t) => selected.includes(t.id));
    const suggestions = draft
      ? terms
          .filter(
            (t) =>
              !selected.includes(t.id) &&
              t.name.toLowerCase().includes(draft.toLowerCase())
          )
          .slice(0, 6)
      : [];
    return (
      <Card title={label}>
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full bg-bolt-ds-bgTertiary px-2 py-0.5 text-xs"
            >
              {t.name}
              <button
                type="button"
                onClick={() => onChange(selected.filter((id) => id !== t.id))}
                aria-label={`Remove ${t.name}`}
                disabled={disabled}
                className="text-bolt-ds-iconTertiary hover:text-bolt-ds-textPrimary disabled:opacity-40"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="relative mt-2">
          <Input
            value={draft}
            placeholder={`Add ${singular}, press Enter`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                void create(draft);
              }
            }}
            disabled={disabled || adding}
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full list-none rounded-md border border-bolt-ds-borderSecondary bg-bolt-ds-bgAlt p-1 text-sm shadow-lg">
              {suggestions.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-bolt-ds-bgHover"
                    onClick={() => {
                      onChange([...selected, t.id]);
                      setDraft('');
                    }}
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    );
  }

  const tree = buildTree(terms);
  return (
    <Card title={label}>
      <div className="max-h-56 overflow-y-auto">
        {tree.length === 0 && (
          <p className="m-0 text-xs text-bolt-ds-textTertiary">None yet.</p>
        )}
        <TermChecklist
          nodes={tree}
          selected={selected}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={draft}
          placeholder={`New ${singular}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void create(draft);
            }
          }}
          disabled={disabled}
        />
        <Button
          size="sm"
          icon={<Plus size={14} />}
          loading={adding}
          onClick={() => create(draft)}
          disabled={disabled || !draft.trim()}
        >
          Add
        </Button>
      </div>
    </Card>
  );
}

type TermNode = Term & { children: TermNode[] };

function buildTree(terms: Term[]): TermNode[] {
  const byId = new Map<number, TermNode>();
  terms.forEach((t) => byId.set(t.id, { ...t, children: [] }));
  const roots: TermNode[] = [];
  byId.forEach((n) => {
    const parent = n.parent ? byId.get(n.parent) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  });
  return roots;
}

function TermChecklist({
  nodes,
  selected,
  onChange,
  disabled,
  depth = 0,
}: {
  nodes: TermNode[];
  selected: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  depth?: number;
}) {
  return (
    <ul className="m-0 list-none p-0">
      {nodes.map((n) => (
        <li key={n.id} style={{ paddingLeft: depth * 14 }}>
          <Checkbox
            className="py-0.5"
            checked={selected.includes(n.id)}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...selected, n.id]
                  : selected.filter((id) => id !== n.id)
              )
            }
            label={n.name}
          />
          {n.children.length > 0 && (
            <TermChecklist
              nodes={n.children}
              selected={selected}
              onChange={onChange}
              disabled={disabled}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
