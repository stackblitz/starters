import {
  type RouteConfig,
  index,
  layout,
  route,
} from '@react-router/dev/routes';

export default [
  /* Public site. The catch-all resolves WordPress permalinks (pages by
     hierarchical path, posts by slug, redirects) like WP's rewrite engine. */
  layout('routes/site/layout.tsx', [
    index('routes/site/home.tsx'),
    route('blog', 'routes/site/blog.tsx'),
    route('category/:slug', 'routes/site/category.tsx'),
    route('tag/:slug', 'routes/site/tag.tsx'),
    route('author/:slug', 'routes/site/author.tsx'),
    route('search', 'routes/site/search.tsx'),
    route('*', 'routes/site/catch-all.tsx'),
  ]),

  /* Bolt CMS admin. Renders only inside Bolt's Admin tab (bolt-admin bridge). */
  route('bolt-admin', 'routes/admin/layout.tsx', [
    index('routes/admin/dashboard.tsx'),
    route('content/:type', 'routes/admin/content-list.tsx'),
    route('content/:type/new', 'routes/admin/content-edit.tsx', {
      id: 'admin-content-new',
    }),
    route('content/:type/:id', 'routes/admin/content-edit.tsx', {
      id: 'admin-content-edit',
    }),
    route('media', 'routes/admin/media.tsx'),
    route('comments', 'routes/admin/comments.tsx'),
    route('collection/:kind', 'routes/admin/collection.tsx'),
    route('menus', 'routes/admin/menus.tsx'),
    route('appearance', 'routes/admin/appearance.tsx'),
    route('settings/:tab?', 'routes/admin/settings.tsx'),
  ]),
] satisfies RouteConfig;
