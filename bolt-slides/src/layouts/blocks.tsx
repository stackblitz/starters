import { useEffect } from 'react';
import Slide from '../deck/Slide';
import Timeline from '../components/Timeline';
import Comparison from '../components/Comparison';
import Table from '../components/Table';
import Tabs from '../components/Tabs';
import Accordion from '../components/Accordion';
import Chat from '../components/Chat';
import CodeWindow from '../components/CodeWindow';
import T from '../edit/EditableText';
import LiCtl from '../edit/LiCtl';
import TableEditor from '../edit/TableEditor';
import CodeEditor from '../edit/CodeEditor';
import CompareEditor from '../edit/CompareEditor';
import { useEdit } from '../edit/EditContext';
import { useStore } from '../data/store';
import {
  type LayoutDef,
  e,
  useShow,
  Heading,
  pipe,
  rich,
  normTable,
} from './shared';

const TL_BLANK = { time: 'Q1', title: 'Milestone', body: '' };

const TimelineDef: LayoutDef = {
  type: 'timeline',
  label: 'Timeline',
  defaults: {
    kicker: 'Roadmap',
    title: 'Where this goes.',
    items: [
      { time: 'Q3', title: 'Launch', body: 'Starter ships with the skill.' },
      {
        time: 'Q4',
        title: 'Collaboration',
        body: 'Live cursors and multiplayer editing.',
      },
      {
        time: '2027',
        title: 'Templates',
        body: 'A gallery of themed starting points.',
      },
    ],
  },
  Render: ({ slide }) => (
    <Slide>
      <Heading slide={slide} />
      <Timeline
        items={(slide.props.items ?? []).map(
          (it: Record<string, unknown>, i: number) => ({
            time: e(<T path={`items.${i}.time`} />),
            title: e(
              <LiCtl path="items" index={i} blank={TL_BLANK}>
                <T path={`items.${i}.title`} />
              </LiCtl>
            ),
            body: it.body ? <T path={`items.${i}.body`} block /> : undefined,
          })
        )}
      />
    </Slide>
  ),
};

const normCmp = (p: { cols?: unknown; rows?: unknown[] }) => ({
  cols: Array.isArray(p.cols)
    ? (p.cols as string[])
    : pipe(p.cols as string | undefined),
  rows: ((p.rows ?? []) as { label?: string; values?: unknown }[]).map((r) => ({
    label: r.label ?? '',
    values: Array.isArray(r.values)
      ? (r.values as (boolean | string)[])
      : pipe((r.values as string | undefined) ?? '').map((v) =>
          v === 'yes' ? true : v === 'no' ? false : v
        ),
  })),
});

const ComparisonDef: LayoutDef = {
  type: 'comparison',
  label: 'Comparison',
  defaults: {
    kicker: 'Why us',
    title: 'The honest comparison.',
    cols: ['', 'This starter', 'Slideware'],
    highlight: 0,
    rows: [
      { label: 'Prompt slides into existence', values: [true, false] },
      { label: 'Edit in place', values: [true, true] },
      { label: 'Single-file portability', values: [true, false] },
    ],
  },
  Render: ({ slide }) => {
    const { editable, slideId } = useEdit();
    const setProp = useStore((s) => s.setProp);
    const legacy =
      !Array.isArray(slide.props.cols) ||
      (slide.props.rows ?? []).some(
        (r: { values?: unknown }) => !Array.isArray(r?.values)
      );

    useEffect(() => {
      if (!editable || !slideId || !legacy) return;

      const t = normCmp(slide.props);

      setProp(slideId, 'cols', t.cols);
      setProp(slideId, 'rows', t.rows);
    }, [editable, slideId, legacy, slide.props, setProp]);

    const data = normCmp(slide.props);
    const canEdit = editable && !legacy;

    return (
      <Slide>
        <Heading slide={slide} />
        {canEdit ? (
          <CompareEditor slide={slide} data={data} />
        ) : (
          <Comparison
            cols={data.cols}
            highlight={slide.props.highlight ?? 0}
            rows={data.rows.map((r) => ({
              label: e(rich(r.label)),
              values: r.values,
            }))}
          />
        )}
      </Slide>
    );
  },
};

const TableDef: LayoutDef = {
  type: 'table',
  label: 'Table',
  defaults: {
    kicker: 'The data',
    title: 'By region.',
    columns: ['Region', 'ARR', 'Growth'],
    rows: [
      ['North America', '$2.4M', '+38%'],
      ['Europe', '$1.1M', '+52%'],
      ['APAC', '$0.6M', '+74%'],
    ],
    highlightCol: 2,
    caption: 'Company data, FY26',
  },
  Render: ({ slide }) => {
    const { editable, slideId } = useEdit();
    const setProp = useStore((s) => s.setProp);
    const show = useShow();
    const legacy =
      !Array.isArray(slide.props.columns) ||
      (slide.props.rows ?? []).some((r: unknown) => !Array.isArray(r));

    useEffect(() => {
      if (!editable || !slideId || !legacy) return;

      const t = normTable(slide.props);

      setProp(slideId, 'columns', t.columns);
      setProp(slideId, 'rows', t.rows);
    }, [editable, slideId, legacy, slide.props, setProp]);

    const { columns, rows } = normTable(slide.props);
    const canEdit = editable && !legacy;
    const labels = show(slide.props.labelLeft) && (
      <div className="tbl-labels">
        <span className="kicker">
          <T path="labelLeft" placeholder="Top-left label" />
        </span>
      </div>
    );
    const cls = [
      slide.props.filled && 'tbl-filled',
      slide.props.large && 'tbl-large',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <Slide className={cls || undefined}>
        <Heading slide={slide} />
        {labels}
        {canEdit ? (
          <>
            <TableEditor slide={slide} />
            {show(slide.props.caption) && (
              <div
                className="foot dtable-caption"
                style={{ maxWidth: 880, marginInline: 'auto' }}
              >
                <T path="caption" placeholder="Caption" />
              </div>
            )}
          </>
        ) : (
          <Table
            columns={columns}
            rows={rows.map((r) => r.map((cell) => rich(cell)))}
            highlightCol={slide.props.highlightCol ?? undefined}
            caption={slide.props.caption || undefined}
          />
        )}
      </Slide>
    );
  },
};

const TAB_BLANK = { label: 'Tab', content: '' };

const TabsDef: LayoutDef = {
  type: 'tabs',
  label: 'Tabs',
  defaults: {
    kicker: 'One tool',
    title: 'Three audiences.',
    tabs: [
      {
        label: 'Founders',
        content: 'Pitch decks that stay on brand without a designer.',
      },
      {
        label: 'Product',
        content: 'Roadmaps and reviews, statuses on every slide.',
      },
      {
        label: 'Sales',
        content: 'Duplicate the master deck, tailor it per prospect.',
      },
    ],
  },
  Render: ({ slide }) => {
    const { editable, slideId } = useEdit();
    const setProp = useStore((s) => s.setProp);

    return (
      <Slide>
        <Heading slide={slide} />
        <Tabs
          onAdd={
            editable && slideId
              ? () =>
                  setProp(slideId, 'tabs', [
                    ...(slide.props.tabs ?? []),
                    structuredClone(TAB_BLANK),
                  ])
              : undefined
          }
          tabs={(slide.props.tabs ?? []).map(
            (t: { label: string; content: string }, i: number) => ({
              label: e(<T path={`tabs.${i}.label`} />),
              content: (
                <div className="lead" style={{ maxWidth: '52ch' }}>
                  <LiCtl path="tabs" index={i} blank={TAB_BLANK}>
                    <T path={`tabs.${i}.content`} block />
                  </LiCtl>
                </div>
              ),
            })
          )}
        />
      </Slide>
    );
  },
};

const QA_BLANK = {
  q: 'A question people actually ask?',
  a: 'The short, honest answer.',
};

const QaDef: LayoutDef = {
  type: 'qa',
  label: 'Q & A',
  defaults: {
    title: 'The questions we hear\nmost, ==answered==.',
    items: [
      {
        q: 'How long does this take to set up?',
        a: 'Minutes — one prompt produces the working draft.',
      },
      {
        q: 'Can I change what it made?',
        a: 'Everything: text in place, layouts, backgrounds, motion.',
      },
      {
        q: 'Where does the data live?',
        a: 'One portable file you can copy, back up, or hand off.',
      },
      {
        q: 'Is this only for pitches?',
        a: 'Any deck — reviews, all-hands, teaching, proposals.',
      },
    ],
  },
  Render: ({ slide }) => (
    <Slide className={slide.props.large ? 'qa-wide' : undefined}>
      <h2 className="headline qa-title">
        <T path="title" placeholder="Title" />
      </h2>
      <div className={'qa-rows' + (slide.props.large ? ' large' : '')}>
        {(slide.props.items ?? []).map((_: unknown, i: number) => (
          <div key={i} className="qa-row">
            <div className="qa-q">
              <span className="qa-mark" aria-hidden>
                Q
              </span>
              <LiCtl path="items" index={i} blank={QA_BLANK}>
                <T path={`items.${i}.q`} />
              </LiCtl>
            </div>
            <div className="qa-a">
              <span className="qa-mark qa-mark-a" aria-hidden>
                A
              </span>
              <T path={`items.${i}.a`} />
            </div>
          </div>
        ))}
      </div>
    </Slide>
  ),
};

const ACC_BLANK = { title: 'Question', body: 'Answer' };

const AccordionDef: LayoutDef = {
  type: 'accordion',
  label: 'Accordion',
  defaults: {
    kicker: 'Questions',
    title: 'Asked and answered.',
    items: [
      {
        title: 'Where does the data live?',
        body: 'In Postgres (`deck` and `slides`). The editor and prompted decks share that store.',
      },
      {
        title: 'Can I change what the AI made?',
        body: 'Everything: text in place, layouts, backgrounds, animations.',
      },
    ],
  },
  Render: ({ slide }) => (
    <Slide>
      <Heading slide={slide} />
      <Accordion
        items={(slide.props.items ?? []).map((_: unknown, i: number) => ({
          title: e(
            <LiCtl path="items" index={i} blank={ACC_BLANK}>
              <T path={`items.${i}.title`} />
            </LiCtl>
          ),
          body: <T path={`items.${i}.body`} block />,
        }))}
      />
    </Slide>
  ),
};

const MSG_BLANK = { from: 'user', text: 'Message' };

const ChatDef: LayoutDef = {
  type: 'chat',
  label: 'Chat',
  defaults: {
    kicker: 'Prompt it',
    title: 'Slides, spoken into existence.',
    name: 'Bolt',
    messages: [
      {
        from: 'user',
        text: 'Make me a 10-slide seed pitch for a robotics startup.',
      },
      {
        from: 'ai',
        text: 'Done — cover, problem, product, traction, team, ask. Want the traction slide as a chart?',
      },
    ],
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <Chat
        kicker={
          show(slide.props.kicker)
            ? e(<T path="kicker" placeholder="Kicker" />)
            : undefined
        }
        title={
          show(slide.props.title)
            ? e(<T path="title" placeholder="Title" />)
            : undefined
        }
        name={e(<T path="name" placeholder="Assistant" />)}
        messages={(slide.props.messages ?? []).map(
          (m: { from: 'user' | 'ai' }, i: number) => ({
            from: m.from,
            text: e(
              <LiCtl path="messages" index={i} blank={MSG_BLANK}>
                <T path={`messages.${i}.text`} block />
              </LiCtl>
            ),
          })
        )}
      />
    );
  },
};

const CodeDef: LayoutDef = {
  type: 'code',
  label: 'Code',
  defaults: {
    kicker: 'For developers',
    title: 'Author a deck as data.',
    filename: 'deck.json',
    code: '{\n  "layout": "bigNumber",\n  "props": { "value": "$3T", "caption": "the market" },\n  "animation": "cascade"\n}',
    highlight: '',
  },
  Render: ({ slide }) => {
    const { editable } = useEdit();

    return (
      <Slide>
        <Heading slide={slide} tight />
        <div style={{ maxWidth: 760, marginInline: 'auto' }}>
          {editable ? (
            <CodeEditor slide={slide} />
          ) : (
            <CodeWindow
              title={slide.props.filename || 'code'}
              code={slide.props.code ?? ''}
              highlight={String(slide.props.highlight ?? '')
                .split(',')
                .map((n) => parseInt(n.trim(), 10))
                .filter(Number.isFinite)}
            />
          )}
        </div>
      </Slide>
    );
  },
};

export const blockLayouts = [
  TimelineDef,
  ComparisonDef,
  TableDef,
  TabsDef,
  AccordionDef,
  QaDef,
  ChatDef,
  CodeDef,
];
