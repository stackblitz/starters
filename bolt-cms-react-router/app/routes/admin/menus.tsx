import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  deleteMenu,
  deleteMenuItem,
  insertMenu,
  insertMenuItem,
  listCollection,
  listContent,
  listMenuItems,
  listMenus,
  updateMenuItem,
  updateMenuLocation,
} from '@/admin/api';
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  useToast,
} from '@/admin/components/ui';
import { errorMessage, isRejectedByUser, useAsync, useCanEdit } from '@/admin/hooks';
import { slugify } from '@/lib/cms/format';
import type { MenuItem } from '@/lib/cms/types';

/**
 * WordPress-style menu editor: a flat, ordered list where indenting an item
 * makes it a child of the item above. Saved as `position` + `parent_id`.
 */
export default function Menus() {
  const toast = useToast();
  const canEdit = useCanEdit();
  const menus = useAsync(listMenus, []);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState('');
  const [newName, setNewName] = useState<string | null>(null);

  useEffect(() => {
    if (menus.data?.length && menuId === null) setMenuId(menus.data[0].id);
  }, [menus.data, menuId]);

  const menu = menus.data?.find((m) => m.id === menuId) ?? null;

  const loaded = useAsync(
    async () => (menuId ? listMenuItems(menuId) : []),
    [menuId]
  );
  useEffect(() => {
    if (loaded.data) {
      setItems(flatten(loaded.data));
      setDirty(false);
    }
  }, [loaded.data]);
  useEffect(() => {
    setLocation(menu?.location ?? '');
  }, [menu]);

  // listContent, not listContentOptions: menu items store the URL, so we need the slug
  const pages = useAsync(() => listContent('page', { status: 'publish', perPage: 200 }), []);
  const posts = useAsync(() => listContent('post', { status: 'publish', perPage: 50 }), []);
  const categories = useAsync(() => listCollection('category'), []);

  function mutate(next: MenuItem[]) {
    setItems(next);
    setDirty(true);
  }

  function add(
    item: Omit<MenuItem, 'id' | 'menu_id' | 'position' | 'parent_id'>
  ) {
    if (!menuId) return;
    mutate([
      ...items,
      {
        ...item,
        id: -Date.now(),
        menu_id: menuId,
        position: items.length,
        parent_id: null,
      } as MenuItem,
    ]);
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    mutate(next);
  }

  function indent(index: number, dir: -1 | 1) {
    const next = [...items];
    const item = { ...next[index] };
    if (dir === 1) {
      // Become child of the nearest previous top-level-or-sibling item.
      const prev = next
        .slice(0, index)
        .reverse()
        .find((p) => p.parent_id === item.parent_id);
      if (!prev) return;
      item.parent_id = prev.id;
    } else {
      if (item.parent_id === null) return;
      const parent = next.find((p) => p.id === item.parent_id);
      item.parent_id = parent?.parent_id ?? null;
    }
    next[index] = item;
    mutate(next);
  }

  function remove(index: number) {
    const id = items[index].id;
    mutate(
      items
        .filter((i, n) => n !== index && i.parent_id !== id)
        .map((i) => (i.parent_id === id ? { ...i, parent_id: null } : i))
    );
  }

  async function save() {
    if (!menu) return;
    setSaving(true);
    try {
      const original = new Map((loaded.data ?? []).map((i) => [i.id, i]));
      const kept = new Set(items.map((i) => i.id));
      for (const id of original.keys()) if (!kept.has(id)) await deleteMenuItem(id);

      // Insert new items first to obtain real ids, then remap parents.
      const idMap = new Map<number, number>();
      for (const [position, item] of items.entries()) {
        if (item.id >= 0) continue;
        const { id, ...rest } = item;
        idMap.set(id, (await insertMenuItem({ ...rest, parent_id: null, position })).id);
      }
      for (const [position, item] of items.entries()) {
        const next: MenuItem = {
          ...item,
          id: idMap.get(item.id) ?? item.id,
          parent_id: item.parent_id === null ? null : (idMap.get(item.parent_id) ?? item.parent_id),
          position,
        };
        const changed =
          item.id < 0 ? next.parent_id !== null : JSON.stringify(next) !== JSON.stringify(original.get(item.id));
        if (changed) await updateMenuItem(next);
      }

      if (location !== (menu.location ?? '')) await updateMenuLocation(menu.id, location || null);

      toast('Menu saved');
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
      // resync with the database, also after a partial failure
      await Promise.all([loaded.refetch(), menus.refetch()]);
    }
  }

  async function createMenu() {
    const name = newName?.trim();
    if (!name) return;
    try {
      const created = await insertMenu({ name, slug: slugify(name), location: null });
      setNewName(null);
      await menus.refetch();
      setMenuId(created.id);
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    }
  }

  async function removeMenu() {
    if (!menu) return;
    try {
      await deleteMenu(menu.id);
      setMenuId(null);
      await menus.refetch();
    } catch (e) {
      if (!isRejectedByUser(e)) toast(errorMessage(e), 'error');
    }
  }

  const depth = (item: MenuItem): number => {
    let d = 0;
    let cur = item;
    while (cur.parent_id !== null) {
      const parent = items.find((i) => i.id === cur.parent_id);
      if (!parent) break;
      d++;
      cur = parent;
    }
    return d;
  };

  const newMenuForm =
    newName === null ? (
      <Button icon={<Plus size={14} />} disabled={!canEdit} onClick={() => setNewName('')}>
        New menu
      </Button>
    ) : (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void createMenu();
        }}
      >
        <Input
          autoFocus
          placeholder="Menu name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setNewName(null)}
          className="w-48"
        />
        <Button type="submit" variant="primary" disabled={!newName.trim()}>
          Create
        </Button>
        <Button type="button" variant="ghost" onClick={() => setNewName(null)}>
          Cancel
        </Button>
      </form>
    );

  return (
    <>
      <PageHeader
        title="Menus"
        actions={
          <>
            {newMenuForm}
            <Button
              variant="primary"
              loading={saving}
              disabled={!canEdit || (!dirty && location === (menu?.location ?? ''))}
              onClick={save}
            >
              Save menu
            </Button>
          </>
        }
      />
      {menus.error && <ErrorNote message={menus.error} />}
      {menus.loading && !menus.data ? (
        <Spinner />
      ) : !menus.data?.length ? (
        <EmptyState
          title="No menus"
          description="Without a primary menu the site header lists your top-level pages."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
            <Card title="Add items">
              <AddItems
                pages={pages.data ?? []}
                posts={posts.data ?? []}
                categories={categories.data ?? []}
                onAdd={add}
              />
            </Card>
          </div>

          <div className="grid content-start gap-4">
            <Card>
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Menu">
                  <Select
                    value={menuId ?? ''}
                    onChange={(e) => setMenuId(Number(e.target.value))}
                  >
                    {menus.data.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Display location"
                  hint="The site header renders the menu at “primary”."
                >
                  <Select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  >
                    <option value="">— None —</option>
                    <option value="primary">Primary (header)</option>
                    <option value="footer">Footer</option>
                  </Select>
                </Field>
                <Button
                  variant="ghost"
                  icon={<Trash2 size={14} />}
                  disabled={!canEdit}
                  onClick={removeMenu}
                >
                  Delete menu
                </Button>
              </div>
            </Card>

            <Card title="Menu structure" padded={false}>
              {loaded.loading && !loaded.data ? (
                <Spinner />
              ) : items.length === 0 ? (
                <p className="m-0 p-6 text-center text-sm text-bolt-ds-textTertiary">
                  Add items from the left.
                </p>
              ) : (
                <ul className="m-0 list-none divide-y divide-bolt-ds-borderSecondary p-0">
                  {items.map((item, index) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-2 px-3 py-2"
                      style={{ paddingLeft: 12 + depth(item) * 24 }}
                    >
                      <div className="grid flex-1 gap-1 sm:grid-cols-2">
                        <Input
                          value={item.title}
                          onChange={(e) =>
                            mutate(
                              items.map((i, n) =>
                                n === index
                                  ? { ...i, title: e.target.value }
                                  : i
                              )
                            )
                          }
                          aria-label="Label"
                        />
                        <Input
                          value={item.url}
                          onChange={(e) =>
                            mutate(
                              items.map((i, n) =>
                                n === index ? { ...i, url: e.target.value } : i
                              )
                            )
                          }
                          className="font-mono text-xs"
                          aria-label="URL"
                        />
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<ArrowUp size={14} />}
                          title="Move up"
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<ArrowDown size={14} />}
                          title="Move down"
                          onClick={() => move(index, 1)}
                          disabled={index === items.length - 1}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<ChevronLeft size={14} />}
                          title="Outdent"
                          onClick={() => indent(index, -1)}
                          disabled={item.parent_id === null}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<ChevronRight size={14} />}
                          title="Indent"
                          onClick={() => indent(index, 1)}
                          disabled={index === 0}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 size={14} />}
                          title="Remove"
                          onClick={() => remove(index)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

/** Depth-first order so children follow their parent in the flat list. */
function flatten(items: MenuItem[]): MenuItem[] {
  const byParent = new Map<number | null, MenuItem[]>();
  for (const i of items) {
    const list = byParent.get(i.parent_id) ?? [];
    list.push(i);
    byParent.set(i.parent_id, list);
  }
  const out: MenuItem[] = [];
  const walk = (parent: number | null) => {
    for (const i of (byParent.get(parent) ?? []).sort(
      (a, b) => a.position - b.position
    )) {
      out.push(i);
      walk(i.id);
    }
  };
  walk(null);
  // Orphans (parent missing) go last.
  for (const i of items)
    if (!out.includes(i)) out.push({ ...i, parent_id: null });
  return out;
}

function AddItems({
  pages,
  posts,
  categories,
  onAdd,
}: {
  pages: Array<{ id: number; title: string; slug: string }>;
  posts: Array<{ id: number; title: string; slug: string }>;
  categories: Array<{ id: number; name: string; slug: string }>;
  onAdd: (
    item: Omit<MenuItem, 'id' | 'menu_id' | 'position' | 'parent_id'>
  ) => void;
}) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  const base = { target: '', classes: '', description: '' };

  return (
    <div className="grid gap-4 text-sm">
      <Group title="Pages">
        {pages.map((p) => (
          <PickButton
            key={p.id}
            onClick={() =>
              onAdd({
                ...base,
                title: p.title,
                url: `/${p.slug}`,
                object_type: 'page',
                object_id: p.id,
              })
            }
          >
            {p.title}
          </PickButton>
        ))}
      </Group>
      <Group title="Posts">
        {posts.map((p) => (
          <PickButton
            key={p.id}
            onClick={() =>
              onAdd({
                ...base,
                title: p.title,
                url: `/${p.slug}`,
                object_type: 'post',
                object_id: p.id,
              })
            }
          >
            {p.title}
          </PickButton>
        ))}
      </Group>
      <Group title="Categories">
        {categories.map((c) => (
          <PickButton
            key={c.id}
            onClick={() =>
              onAdd({
                ...base,
                title: c.name,
                url: `/category/${c.slug}`,
                object_type: 'category',
                object_id: c.id,
              })
            }
          >
            {c.name}
          </PickButton>
        ))}
      </Group>
      <Group title="Custom link">
        <div className="grid gap-2">
          <Input
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Input
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!label || !url}
            onClick={() => {
              onAdd({
                ...base,
                title: label,
                url,
                object_type: 'custom',
                object_id: null,
              });
              setLabel('');
              setUrl('');
            }}
          >
            Add to menu
          </Button>
        </div>
      </Group>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details open className="group/g">
      <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-bolt-ds-textTertiary">
        {title}
      </summary>
      <div className="mt-2 grid max-h-48 gap-0.5 overflow-y-auto">
        {children}
      </div>
    </details>
  );
}

function PickButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between rounded px-2 py-1 text-left hover:bg-bolt-ds-bgHover"
    >
      <span className="truncate">{children}</span>
      <Plus size={12} className="shrink-0 text-bolt-ds-iconTertiary" />
    </button>
  );
}
