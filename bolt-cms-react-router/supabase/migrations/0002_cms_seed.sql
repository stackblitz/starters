/*
  # Bolt CMS seed

  Mirrors a fresh WordPress install so the site renders before an import
  lands, and seeds `cms_fields` so the admin knows how to render each column.

  Safe to re-run: every insert is `on conflict do nothing` / upsert.
*/

-- ---------------------------------------------------------------------------
-- Settings (WordPress fresh-install defaults)
-- ---------------------------------------------------------------------------
insert into cms_settings (key, value) values
  ('site_title',          '"My WordPress Site"'),
  ('tagline',             '"Just another WordPress site"'),
  ('site_url',            '""'),
  ('language',            '"en-US"'),
  ('timezone',            '"UTC"'),
  ('date_format',         '"F j, Y"'),
  ('permalink_structure', '"/%postname%/"'),
  ('show_on_front',       '"posts"'),          -- posts | page
  ('page_on_front',       'null'),
  ('page_for_posts',      'null'),
  ('posts_per_page',      '10'),
  ('theme',               '"classic"'),         -- classic | editorial | minimal
  ('comments_enabled',    'true'),
  ('default_comment_status', '"open"'),
  ('seo',                 '{"title_template": "%title% | %site_title%", "description": "", "og_image": null, "twitter": "", "noindex": false}'),
  ('imported_from',       'null')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Author (WordPress user #1)
-- ---------------------------------------------------------------------------
insert into cms_authors (id, slug, name, email, description) values
  (1, 'admin', 'admin', null, '')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Terms
-- ---------------------------------------------------------------------------
insert into cms_terms (id, taxonomy, name, slug, description) values
  (1, 'category', 'Uncategorized', 'uncategorized', '')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Posts and pages (WordPress defaults: "Hello world!" and "Sample Page")
-- ---------------------------------------------------------------------------
insert into cms_posts (id, type, status, slug, title, excerpt, content_html, author_id, date, modified, comment_status) values
  (
    1, 'post', 'publish', 'hello-world', 'Hello world!',
    'Welcome to WordPress. This is your first post. Edit or delete it, then start writing!',
    '<p>Welcome to WordPress. This is your first post. Edit or delete it, then start writing!</p>',
    1, now() - interval '1 day', now() - interval '1 day', 'open'
  ),
  (
    2, 'page', 'publish', 'sample-page', 'Sample Page',
    '',
    '<p>This is an example page. It''s different from a blog post because it will stay in one place and will show up in your site navigation (in most themes). Most people start with an About page that introduces them to potential site visitors. It might say something like this:</p>'
    || '<blockquote><p>Hi there! I''m a bike messenger by day, aspiring actor by night, and this is my website. I live in Los Angeles, have a great dog named Jack, and I like pi&#241;a coladas. (And gettin'' caught in the rain.)</p></blockquote>'
    || '<p>...or something like this:</p>'
    || '<blockquote><p>The XYZ Doohickey Company was founded in 1971, and has been providing quality doohickeys to the public ever since. Located in Gotham City, XYZ employs over 2,000 people and does all kinds of awesome things for the Gotham community.</p></blockquote>'
    || '<p>As a new WordPress user, you should go to <a href="/admin">your dashboard</a> to delete this page and create new pages for your content. Have fun!</p>',
    1, now() - interval '1 day', now() - interval '1 day', 'closed'
  )
on conflict (id) do nothing;

insert into cms_term_relationships (post_id, term_id) values (1, 1)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Comment (WordPress default "A WordPress Commenter")
-- ---------------------------------------------------------------------------
insert into cms_comments (id, post_id, author_name, author_email, author_url, content_html, status, date) values
  (
    1, 1, 'A WordPress Commenter', 'wapuu@wordpress.example', 'https://wordpress.org/',
    '<p>Hi, this is a comment.</p><p>To get started with moderating, editing, and deleting comments, please visit the Comments screen in the dashboard.</p><p>Commenter avatars come from <a href="https://gravatar.com/">Gravatar</a>.</p>',
    'approved', now() - interval '1 day'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Primary menu
-- ---------------------------------------------------------------------------
insert into cms_menus (id, slug, name, location) values
  (1, 'primary', 'Primary', 'primary')
on conflict (id) do nothing;

insert into cms_menu_items (id, menu_id, position, title, url, object_type, object_id) values
  (1, 1, 0, 'Home', '/', 'custom', null),
  (2, 1, 1, 'Sample Page', '/sample-page', 'page', 2)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Admin field metadata
-- ---------------------------------------------------------------------------
insert into cms_fields (table_name, column_name, label, type, options, group_name, position) values
  -- posts / pages / custom types share cms_posts
  ('cms_posts', 'title',             'Title',            'string',    '{"required": true}', 'main', 0),
  ('cms_posts', 'slug',              'Slug',             'slug',      '{"from": "title"}', 'sidebar', 0),
  ('cms_posts', 'content_html',      'Content',          'richtext',  '{"json_column": "content_json"}', 'main', 1),
  ('cms_posts', 'excerpt',           'Excerpt',          'text',      '{"rows": 3}', 'main', 2),
  ('cms_posts', 'status',            'Status',           'select',    '{"choices": ["publish", "draft", "pending", "private", "future", "trash"]}', 'sidebar', 1),
  ('cms_posts', 'date',              'Publish date',     'datetime',  '{}', 'sidebar', 2),
  ('cms_posts', 'author_id',         'Author',           'reference', '{"table": "cms_authors", "label": "name"}', 'sidebar', 3),
  ('cms_posts', 'featured_media_id', 'Featured image',   'image',     '{}', 'sidebar', 4),
  ('cms_posts', 'parent_id',         'Parent',           'reference', '{"table": "cms_posts", "label": "title", "same_type": true}', 'sidebar', 5),
  ('cms_posts', 'menu_order',        'Order',            'number',    '{}', 'sidebar', 6),
  ('cms_posts', 'comment_status',    'Comments',         'select',    '{"choices": ["open", "closed"]}', 'sidebar', 7),
  ('cms_posts', 'sticky',            'Sticky',           'boolean',   '{}', 'sidebar', 8),
  ('cms_posts', 'template',          'Template',         'string',    '{}', 'advanced', 0),
  ('cms_posts', 'format',            'Format',           'string',    '{}', 'advanced', 1),
  ('cms_posts', 'seo',               'SEO',              'object',    '{"fields": [
      {"key": "title", "label": "SEO title", "type": "string"},
      {"key": "description", "label": "Meta description", "type": "text"},
      {"key": "og_image", "label": "Social image URL", "type": "image"},
      {"key": "canonical", "label": "Canonical URL", "type": "string"},
      {"key": "noindex", "label": "Hide from search engines", "type": "boolean"}
    ]}', 'seo', 0),

  -- media
  ('cms_media', 'title',       'Title',       'string', '{}', 'main', 0),
  ('cms_media', 'alt_text',    'Alt text',    'string', '{}', 'main', 1),
  ('cms_media', 'caption',     'Caption',     'text',   '{}', 'main', 2),
  ('cms_media', 'description', 'Description', 'text',   '{}', 'main', 3),
  ('cms_media', 'local_path',  'File',        'file',   '{"readonly": true}', 'sidebar', 0),
  ('cms_media', 'source_url',  'Source URL',  'string', '{"readonly": true}', 'sidebar', 1),

  -- terms
  ('cms_terms', 'name',        'Name',        'string',    '{"required": true}', 'main', 0),
  ('cms_terms', 'slug',        'Slug',        'slug',      '{"from": "name"}', 'main', 1),
  ('cms_terms', 'description', 'Description', 'text',      '{}', 'main', 2),
  ('cms_terms', 'parent_id',   'Parent',      'reference', '{"table": "cms_terms", "label": "name", "same_taxonomy": true}', 'main', 3),

  -- authors
  ('cms_authors', 'name',        'Name',        'string', '{"required": true}', 'main', 0),
  ('cms_authors', 'slug',        'Slug',        'slug',   '{"from": "name"}', 'main', 1),
  ('cms_authors', 'email',       'Email',       'string', '{}', 'main', 2),
  ('cms_authors', 'url',         'Website',     'string', '{}', 'main', 3),
  ('cms_authors', 'description', 'Bio',         'text',   '{}', 'main', 4),
  ('cms_authors', 'avatar_url',  'Avatar',      'image',  '{}', 'sidebar', 0),

  -- comments
  ('cms_comments', 'author_name',  'Author',  'string',   '{}', 'main', 0),
  ('cms_comments', 'author_email', 'Email',   'string',   '{}', 'main', 1),
  ('cms_comments', 'author_url',   'URL',     'string',   '{}', 'main', 2),
  ('cms_comments', 'content_html', 'Comment', 'text',     '{"rows": 6}', 'main', 3),
  ('cms_comments', 'status',       'Status',  'select',   '{"choices": ["approved", "hold", "spam", "trash"]}', 'sidebar', 0),
  ('cms_comments', 'date',         'Date',    'datetime', '{}', 'sidebar', 1),

  -- menu items
  ('cms_menu_items', 'title',     'Label',       'string', '{"required": true}', 'main', 0),
  ('cms_menu_items', 'url',       'URL',         'string', '{}', 'main', 1),
  ('cms_menu_items', 'target',    'Open in',     'select', '{"choices": ["", "_blank"]}', 'main', 2),
  ('cms_menu_items', 'classes',   'CSS classes', 'string', '{}', 'advanced', 0)
on conflict (table_name, column_name) do update
  set label = excluded.label,
      type = excluded.type,
      options = excluded.options,
      group_name = excluded.group_name,
      position = excluded.position;
