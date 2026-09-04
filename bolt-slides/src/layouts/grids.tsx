import type { ReactNode } from 'react';
import Slide from '../deck/Slide';
import Bento from '../components/Bento';
import StatGrid from '../components/StatGrid';
import Contrast from '../components/Contrast';
import Agenda from '../components/Agenda';
import Steps from '../components/Steps';
import Pricing from '../components/Pricing';
import Team from '../components/Team';
import Marquee from '../components/Marquee';
import T from '../edit/EditableText';
import LiCtl from '../edit/LiCtl';
import {
  type LayoutDef,
  e,
  useShow,
  Num,
  Heading,
  pipe,
  asList,
  strings,
} from './shared';
import { bgCss } from '../edit/bgCss';

const kickerTitle = (
  slide: { props: { kicker?: string; title?: string } },
  show: (v: unknown) => boolean
) => ({
  kicker: show(slide.props.kicker)
    ? e(<T path="kicker" placeholder="Kicker" />)
    : undefined,
  title: show(slide.props.title)
    ? e(<T path="title" placeholder="Title" />)
    : undefined,
});

const TILE_BLANK = { k: 'Label', title: 'Tile', body: '', c: 4, r: 1 };

const BentoDef: LayoutDef = {
  type: 'bento',
  label: 'Bento',
  defaults: {
    kicker: 'What you get',
    title: 'The system, at a glance.',
    tiles: [
      {
        k: 'Speed',
        fig: '3×',
        title: 'Faster to ship',
        body: 'From idea to deployed deck in minutes.',
        c: 8,
        r: 1,
        variant: 'glow',
      },
      { k: 'Uptime', fig: '99.99%', c: 4, r: 1 },
      {
        k: 'Teams',
        title: 'Built for review',
        body: 'Live edits, one source of truth.',
        c: 4,
        r: 1,
      },
      {
        k: 'Scale',
        fig: '48k',
        title: 'Slides generated',
        c: 8,
        r: 1,
        variant: 'accent',
      },
    ],
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <Bento
        {...kickerTitle(slide, show)}
        tiles={asList<Record<string, unknown>>(slide.props.tiles).map(
          (t: Record<string, unknown>, i: number) => {
            const anchor = t.k
              ? 'k'
              : t.title
              ? 'title'
              : t.fig
              ? 'fig'
              : 'body';
            const wrap = (slot: string, node: ReactNode) =>
              slot === anchor ? (
                <LiCtl path="tiles" index={i} blank={TILE_BLANK}>
                  {node}
                </LiCtl>
              ) : (
                node
              );

            return {
              ...t,
              k: t.k ? e(wrap('k', <T path={`tiles.${i}.k`} />)) : undefined,
              fig: t.fig
                ? wrap(
                    'fig',
                    <Num path={`tiles.${i}.fig`} value={String(t.fig)} />
                  )
                : undefined,
              title: t.title
                ? e(wrap('title', <T path={`tiles.${i}.title`} />))
                : undefined,
              body: t.body
                ? e(wrap('body', <T path={`tiles.${i}.body`} block />))
                : undefined,
            };
          }
        )}
      />
    );
  },
};

const STAT_BLANK = { value: '42%', label: 'Label' };

const StatGridDef: LayoutDef = {
  type: 'statGrid',
  label: 'Stat grid',
  defaults: {
    kicker: 'Proof',
    title: 'The numbers hold up.',
    stats: [
      {
        value: '48%',
        label: 'Faster reviews',
        caption: 'vs. previous quarter',
      },
      { value: '$1.2M', label: 'Pipeline created' },
      { value: '9', label: 'Markets live' },
    ],
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <StatGrid
        {...kickerTitle(slide, show)}
        stats={asList<Record<string, unknown>>(slide.props.stats).map(
          (s: Record<string, unknown>, i: number) => ({
            value: (
              <Num path={`stats.${i}.value`} value={String(s.value ?? '')} />
            ),
            label: e(
              <LiCtl path="stats" index={i} blank={STAT_BLANK}>
                <T path={`stats.${i}.label`} />
              </LiCtl>
            ),
            caption: s.caption
              ? e(<T path={`stats.${i}.caption`} />)
              : undefined,
          })
        )}
      />
    );
  },
};

const ContrastDef: LayoutDef = {
  type: 'contrast',
  label: 'Contrast',
  defaults: {
    kicker: 'The shift',
    title: 'Stop rebuilding. Start ==shipping==.',
    left: {
      label: 'Before',
      title: 'Slide chaos',
      points: [
        'Decks rebuilt from scratch',
        'Feedback lost in email',
        'Nobody knows what changed',
      ],
    },
    right: {
      label: 'After',
      title: 'One living deck',
      points: [
        'Slides prompted into existence',
        'Notes travel with the deck',
        'Share a link, not a file',
      ],
    },
  },
  Render: ({ slide }) => {
    const show = useShow();
    const panel = (side: 'left' | 'right') => ({
      label: show(slide.props[side]?.label)
        ? e(<T path={`${side}.label`} placeholder="Chip" />)
        : undefined,
      title: show(slide.props[side]?.title)
        ? e(<T path={`${side}.title`} placeholder="Panel title" />)
        : undefined,
      points: strings(slide.props[side]?.points).map((_, i: number) => (
        <LiCtl key={i} path={`${side}.points`} index={i} blank="">
          <T path={`${side}.points.${i}`} />
        </LiCtl>
      )),
    });

    return (
      <Contrast
        {...kickerTitle(slide, show)}
        left={panel('left')}
        right={panel('right')}
      />
    );
  },
};

const AGENDA_BLANK = { title: 'Topic' };

const AgendaDef: LayoutDef = {
  type: 'agenda',
  label: 'Agenda',
  defaults: {
    kicker: 'Agenda',
    title: "What we'll cover.",
    items: [
      { title: 'The problem', hint: '5 min' },
      { title: 'The product' },
      { title: 'The ask' },
    ],
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <Agenda
        {...kickerTitle(slide, show)}
        items={asList<Record<string, unknown>>(slide.props.items).map(
          (it: Record<string, unknown>, i: number) => ({
            title: e(
              <LiCtl path="items" index={i} blank={AGENDA_BLANK}>
                <T path={`items.${i}.title`} />
              </LiCtl>
            ),
            hint: it.hint ? e(<T path={`items.${i}.hint`} />) : undefined,
          })
        )}
      />
    );
  },
};

const STEP_BLANK = { title: 'Step', body: '' };

const StepsDef: LayoutDef = {
  type: 'steps',
  label: 'Steps',
  defaults: {
    kicker: 'How it works',
    title: 'Three steps to a finished deck.',
    items: [
      {
        title: 'Prompt',
        body: 'Describe the deck; the skill authors it as data.',
      },
      { title: 'Refine', body: 'Edit any text in place, restyle any slide.' },
      {
        title: 'Present',
        body: 'Full-screen engine with builds and presenter view.',
      },
    ],
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <Steps
        {...kickerTitle(slide, show)}
        items={asList<Record<string, unknown>>(slide.props.items).map(
          (it: Record<string, unknown>, i: number) => ({
            title: e(
              <LiCtl path="items" index={i} blank={STEP_BLANK}>
                <T path={`items.${i}.title`} />
              </LiCtl>
            ),
            body: it.body ? <T path={`items.${i}.body`} block /> : undefined,
          })
        )}
      />
    );
  },
};

const TIER_BLANK = { name: 'Tier', price: '$0', period: '/mo', features: [] };

const PricingDef: LayoutDef = {
  type: 'pricing',
  label: 'Pricing',
  defaults: {
    kicker: 'Pricing',
    title: 'Simple, honest plans.',
    tiers: [
      {
        name: 'Starter',
        price: '$0',
        period: '/mo',
        features: ['1 deck', 'PDF export'],
      },
      {
        name: 'Pro',
        price: '$19',
        period: '/mo',
        features: ['Unlimited decks', 'Presenter notes', 'OG images'],
        highlight: true,
        badge: 'Most popular',
      },
      {
        name: 'Team',
        price: '$49',
        period: '/mo',
        features: ['Everything in Pro', 'Custom themes', 'Priority support'],
      },
    ],
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <Pricing
        {...kickerTitle(slide, show)}
        tiers={asList<Record<string, unknown>>(slide.props.tiers).map(
          (t: Record<string, unknown>, i: number) => ({
            ...t,
            name: e(
              <LiCtl path="tiers" index={i} blank={TIER_BLANK}>
                <T path={`tiers.${i}.name`} />
              </LiCtl>
            ),
            price: e(<T path={`tiers.${i}.price`} />),
            period: t.period ? e(<T path={`tiers.${i}.period`} />) : undefined,
            blurb: t.blurb
              ? e(<T path={`tiers.${i}.blurb`} block />)
              : undefined,
            badge: t.highlight
              ? e(<T path={`tiers.${i}.badge`} placeholder="Most popular" />)
              : undefined,
            features: strings(t.features).map((_, fi) =>
              e(
                <LiCtl
                  key={fi}
                  path={`tiers.${i}.features`}
                  index={fi}
                  blank=""
                >
                  <T path={`tiers.${i}.features.${fi}`} />
                </LiCtl>
              )
            ),
          })
        )}
      />
    );
  },
};

const PERSON_BLANK = { name: 'Name', role: 'Role' };

const TeamDef: LayoutDef = {
  type: 'team',
  label: 'Team',
  defaults: {
    kicker: 'The team',
    title: 'Built by operators.',
    people: [
      { name: 'Dana Kim', role: 'CEO · ex-Stripe' },
      { name: 'Ade Obi', role: 'CTO' },
      { name: 'Mia Chen', role: 'Design' },
    ],
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <Team
        {...kickerTitle(slide, show)}
        people={asList<{ name?: string; role?: string; img?: string }>(
          slide.props.people
        ).map(
          (p: { name?: string; role?: string; img?: string }, i: number) => ({
            img: p.img || undefined,
            initials: (p.name ?? '')
              .split(/\s+/)
              .map((w) => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase(),
            name: (
              <LiCtl path="people" index={i} blank={PERSON_BLANK}>
                <T path={`people.${i}.name`} />
              </LiCtl>
            ),
            role: p.role ? <T path={`people.${i}.role`} /> : undefined,
          })
        )}
      />
    );
  },
};

const FIG_BLANK = { label: 'A SMALL LABEL', value: '42%', caption: '' };

const FiguresDef: LayoutDef = {
  type: 'figures',
  label: 'Figures',
  defaults: {
    title: 'A few numbers worth ==sitting with==.',
    body: 'One short paragraph that tells the reader how to weigh what follows — where the numbers come from and why they matter.',
    items: [
      {
        label: 'FIRST MEASURE, YOY',
        value: '+48%',
        caption: 'WHAT THIS FIGURE COUNTS',
      },
      { label: 'SECOND MEASURE', value: '92%', caption: 'AND ITS SOURCE' },
      { label: 'THIRD MEASURE', value: '17', caption: '' },
    ],
  },
  Render: ({ slide }) => {
    const show = useShow();
    const items = asList<{
      label: string;
      value: string;
    }>(slide.props.items);

    return (
      <Slide full>
        <div className="figures">
          <div className="figures-head">
            <h2 className="headline figures-title">
              <T path="title" placeholder="Title" />
            </h2>
            {show(slide.props.body) && (
              <div className="lead figures-intro">
                <T path="body" placeholder="Intro" block />
              </div>
            )}
          </div>
          <div
            className={'figures-row' + (slide.props.cards ? ' cards' : '')}
            style={{ ['--n' as never]: String(Math.max(1, items.length)) }}
          >
            {items.map((it, i) => (
              <div
                key={i}
                className={'figures-cell' + (slide.props.cards ? ' mat' : '')}
                style={
                  slide.props.cards
                    ? { background: bgCss(slide.props.cardBg) }
                    : undefined
                }
              >
                <div className="kicker figures-label">
                  <LiCtl path="items" index={i} blank={FIG_BLANK}>
                    <T path={`items.${i}.label`} />
                  </LiCtl>
                </div>
                <div className="figures-value">
                  <Num
                    path={`items.${i}.value`}
                    value={String(it.value ?? '')}
                  />
                </div>
                {show((it as { caption?: string }).caption) && (
                  <div className="kicker figures-caption">
                    <T path={`items.${i}.caption`} placeholder="Caption" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Slide>
    );
  },
};

const PILLAR_BLANK = {
  title: 'Focus area',
  body: 'Two or three sentences on what this covers and why it earns a column.',
};

const PillarsDef: LayoutDef = {
  type: 'pillars',
  label: 'Pillars',
  defaults: {
    title: 'Where we are ==focusing==.',
    items: [
      {
        title: 'First area',
        body: 'What it covers, in plain words, and the change people should expect to see.',
      },
      {
        title: 'Second area',
        body: 'The unglamorous day-to-day part — named honestly so the room trusts the rest.',
      },
      {
        title: 'Third area',
        body: 'The structural piece: policy, budget, defaults — where intent becomes durable.',
      },
    ],
  },
  Render: ({ slide }) => {
    const items = asList<{
      title: string;
      body?: string;
    }>(slide.props.items);

    return (
      <Slide full>
        <div className={'pillars' + (slide.props.large ? ' large' : '')}>
          <h2 className="headline pillars-title">
            <T path="title" placeholder="Title" />
          </h2>
          <div
            className="pillars-row"
            style={{ ['--n' as never]: String(Math.max(1, items.length)) }}
          >
            {items.map((it, i) => (
              <div key={i} className="pillars-cell">
                <div className="pillars-no" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="pillars-head">
                  <LiCtl path="items" index={i} blank={PILLAR_BLANK}>
                    <T path={`items.${i}.title`} />
                  </LiCtl>
                </h3>
                <div className="pillars-body">
                  <T path={`items.${i}.body`} placeholder="Body" block />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Slide>
    );
  },
};

const LogosDef: LayoutDef = {
  type: 'logos',
  label: 'Logo wall',
  defaults: {
    kicker: 'Trusted by',
    title: '',
    items: 'Acme | Northwind | Globex | Initech | Umbrella | Stark',
  },
  Render: ({ slide }) => (
    <Slide center>
      <Heading slide={slide} tight />
      <div style={{ width: '100%', marginTop: 'clamp(16px,3vh,30px)' }}>
        <Marquee items={pipe(slide.props.items).filter(Boolean)} />
      </div>
    </Slide>
  ),
};

export const gridLayouts = [
  BentoDef,
  StatGridDef,
  FiguresDef,
  ContrastDef,
  AgendaDef,
  StepsDef,
  PillarsDef,
  PricingDef,
  TeamDef,
  LogosDef,
];
