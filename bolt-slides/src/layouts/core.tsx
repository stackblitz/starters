import Slide from '../deck/Slide';
import Reveal from '../deck/Reveal';
import Cover from '../components/Cover';
import Section from '../components/Section';
import Quote from '../components/Quote';
import BigNumber from '../components/BigNumber';
import T from '../edit/EditableText';
import {
  type LayoutDef,
  e,
  useShow,
  Num,
} from './shared';

const CoverDef: LayoutDef = {
  type: 'cover',
  label: 'Cover',
  defaults: {
    kicker: 'Company · 2026',
    title: 'A ==bold== opening.',
    subtitle: 'One sharp sentence on what this deck argues.',
    foot: 'August 2026 · Your name',
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <Cover
        kicker={
          show(slide.props.kicker)
            ? e(<T path="kicker" placeholder="Kicker" />)
            : undefined
        }
        title={<T path="title" placeholder="Title" />}
        subtitle={
          show(slide.props.subtitle) ? (
            <T path="subtitle" placeholder="Subtitle" block />
          ) : undefined
        }
        image={slide.props.image || undefined}
        dim={slide.props.dim}
        foot={
          show(slide.props.foot)
            ? e(<T path="foot" placeholder="Date · Presenter" />)
            : undefined
        }
      />
    );
  },
};

const SectionDef: LayoutDef = {
  type: 'section',
  label: 'Section',
  defaults: { n: 1, kicker: 'Part one', title: 'A new ==chapter==.' },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <Section
        n={slide.props.n}
        kicker={
          show(slide.props.kicker)
            ? e(<T path="kicker" placeholder="Kicker" />)
            : undefined
        }
        title={<T path="title" placeholder="Title" />}
        image={slide.props.image || undefined}
        dim={slide.props.dim}
      />
    );
  },
};

const StatementDef: LayoutDef = {
  type: 'statement',
  label: 'Statement',
  defaults: {
    kicker: '',
    title: 'Say the ==one thing== this slide exists to say.',
    body: '',
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <Slide center>
        {show(slide.props.kicker) && (
          <Reveal>
            <div className="kicker" style={{ marginBottom: 14 }}>
              <T path="kicker" placeholder="Kicker" />
            </div>
          </Reveal>
        )}
        <Reveal delay={0.08}>
          <h2
            className="display"
            style={{ maxWidth: '18ch', marginInline: 'auto' }}
          >
            <T path="title" placeholder="Statement" />
          </h2>
        </Reveal>
        {show(slide.props.body) && (
          <Reveal delay={0.16}>
            <p className="subhead" style={{ marginTop: 18 }}>
              <T path="body" placeholder="Supporting line" block />
            </p>
          </Reveal>
        )}
      </Slide>
    );
  },
};

const BigNumberDef: LayoutDef = {
  type: 'bigNumber',
  label: 'Big number',
  defaults: {
    kicker: 'The market',
    value: '$3T',
    caption: 'moves through this problem every year',
    foot: 'Source: —',
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <BigNumber
        kicker={
          show(slide.props.kicker)
            ? e(<T path="kicker" placeholder="Kicker" />)
            : undefined
        }
        value={<Num path="value" value={slide.props.value} />}
        caption={
          show(slide.props.caption) ? (
            <T path="caption" placeholder="Caption" block />
          ) : undefined
        }
        foot={
          show(slide.props.foot)
            ? e(<T path="foot" placeholder="Source" />)
            : undefined
        }
      />
    );
  },
};

const QuoteDef: LayoutDef = {
  type: 'quote',
  label: 'Quote',
  defaults: {
    text: 'It changed how we work — completely.',
    name: 'Dana Kim',
    role: 'VP Engineering, Acme',
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <Quote
        text={<T path="text" placeholder="Quote" />}
        name={
          show(slide.props.name) ? (
            <T path="name" placeholder="Name" />
          ) : undefined
        }
        role={
          show(slide.props.role) ? (
            <T path="role" placeholder="Role" />
          ) : undefined
        }
        initials={String(slide.props.name ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .map((w: string) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()}
        img={slide.props.img || undefined}
        image={slide.props.image || undefined}
        dim={slide.props.dim}
      />
    );
  },
};

const ManifestoDef: LayoutDef = {
  type: 'manifesto',
  label: 'Manifesto',
  defaults: {
    label: 'A SMALL LABEL UP HERE',
    text: 'A few unhurried sentences that make one argument properly. Large enough to feel deliberate, with the bottom of the slide left empty on purpose — the silence is part of the design.',
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <Slide full>
        <div className="manifesto">
          {show(slide.props.label) && (
            <div className="kicker manifesto-label">
              <T path="label" placeholder="Label" />
            </div>
          )}
          <div className="manifesto-text">
            <T path="text" placeholder="The statement" block />
          </div>
        </div>
      </Slide>
    );
  },
};

export const coreLayouts = [
  CoverDef,
  SectionDef,
  StatementDef,
  ManifestoDef,
  BigNumberDef,
  QuoteDef,
];
