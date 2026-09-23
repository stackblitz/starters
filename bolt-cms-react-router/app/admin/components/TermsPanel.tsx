import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { saveTerm } from '@/admin/api';
import { taxonomyLabel } from '@/admin/labels';
import { slugify } from '@/lib/cms/format';
import type { Term } from '@/lib/cms/types';

import { Button, Card, Checkbox, Input, useToast } from './ui';

/**
 * Category-style (checklist, hierarchical) or tag-style (chips) term picker.
 * New terms are created immediately so ids exist when the post saves.
 */
export function TermsPanel({
  taxonomy,
  terms,
  selected,
  onChange,
  onTermCreated,
}: {
  taxonomy: string;
  terms: Term[];
  selected: number[];
  onChange: (ids: number[]) => void;
  onTermCreated: (term: Term) => void;
}) {
  const tagStyle = /tag/i.test(taxonomy);
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
      const term = await saveTerm({
        taxonomy,
        name: clean,
        slug: slugify(clean),
      });
      onTermCreated(term);
      onChange([...selected, term.id]);
      setDraft('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not add term', 'error');
    } finally {
      setAdding(false);
    }
  }

  if (tagStyle) {
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
      <Card title={taxonomyLabel(taxonomy, true)}>
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
                className="text-bolt-ds-iconTertiary hover:text-bolt-ds-textPrimary"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="relative mt-2">
          <Input
            value={draft}
            placeholder={`Add ${taxonomyLabel(
              taxonomy
            ).toLowerCase()}, press Enter`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                void create(draft);
              }
            }}
            disabled={adding}
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
    <Card title={taxonomyLabel(taxonomy, true)}>
      <div className="max-h-56 overflow-y-auto">
        {tree.length === 0 && (
          <p className="m-0 text-xs text-bolt-ds-textTertiary">None yet.</p>
        )}
        <TermChecklist nodes={tree} selected={selected} onChange={onChange} />
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={draft}
          placeholder={`New ${taxonomyLabel(taxonomy).toLowerCase()}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void create(draft);
            }
          }}
        />
        <Button
          size="sm"
          icon={<Plus size={14} />}
          loading={adding}
          onClick={() => create(draft)}
          disabled={!draft.trim()}
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
    const parent = n.parent_id ? byId.get(n.parent_id) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  });
  return roots;
}

function TermChecklist({
  nodes,
  selected,
  onChange,
  depth = 0,
}: {
  nodes: TermNode[];
  selected: number[];
  onChange: (ids: number[]) => void;
  depth?: number;
}) {
  return (
    <ul className="m-0 list-none p-0">
      {nodes.map((n) => (
        <li key={n.id} style={{ paddingLeft: depth * 14 }}>
          <Checkbox
            className="py-0.5"
            checked={selected.includes(n.id)}
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
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
