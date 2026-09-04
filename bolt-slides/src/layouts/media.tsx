import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Slide from '../deck/Slide';
import {
  BarChart,
  LineChart,
  DonutChart,
  GroupedBarChart,
} from '../components/Charts';
import T from '../edit/EditableText';
import LiCtl from '../edit/LiCtl';
import { useEdit } from '../edit/EditContext';
import { useStore } from '../data/store';
import { offsetTo } from '../edit/measure';
import type { SlideData } from '../data/types';
import {
  type LayoutDef,
  e,
  useShow,
  Heading,
  pipe,
  asList,
} from './shared';

const BAR_BLANK = { label: 'Q1', value: 10 };

function BarsEditor({
  slide,
  bars,
  children,
}: {
  slide: SlideData;
  bars: { label: string; value: number }[];
  children: ReactNode;
}) {
  const { slideId } = useEdit();
  const setProp = useStore((s) => s.setProp);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tracks, setTracks] = useState<
    { x: number; y: number; w: number; h: number }[]
  >([]);
  void slide;

  useLayoutEffect(() => {
    const update = () => {
      const wrap = wrapRef.current;

      if (!wrap) return;

      setTracks(
        Array.from(wrap.querySelectorAll('.ch-bar-track')).map((el) => {
          const t = el as HTMLElement;
          const o = offsetTo(t, wrap);
          return { x: o.x, y: o.y, w: t.offsetWidth, h: t.offsetHeight };
        })
      );
    };

    update();
    const ro = new ResizeObserver(update);

    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => ro.disconnect();
  }, [bars.length]);

  const startDrag = (i: number) => (ev: React.MouseEvent) => {
    if (ev.button !== 0 || !slideId) return;

    ev.preventDefault();
    ev.stopPropagation();

    const track = wrapRef.current?.querySelectorAll('.ch-bar-track')[i] as
      | HTMLElement
      | undefined;

    if (!track) return;

    const vh = track.getBoundingClientRect().height || 1;
    const max = Math.max(...bars.map((b) => b.value), 1);
    const startV = bars[i].value;
    const y0 = ev.clientY;

    document.body.classList.add('li-dragging');

    const onMove = (m: MouseEvent) => {
      const v = Math.max(0, Math.round(startV + (y0 - m.clientY) * (max / vh)));

      setProp(
        slideId,
        'bars',
        bars.map((b, j) => (j === i ? { ...b, value: v } : b))
      );
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('li-dragging');
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="chart-edit" ref={wrapRef}>
      {children}
      {tracks.map((t, i) => (
        <div
          key={i}
          className="chart-drag"
          title="Drag to change value"
          style={{ left: t.x, top: t.y, width: t.w, height: t.h }}
          onMouseDown={startDrag(i)}
        />
      ))}
    </div>
  );
}

const PosterDef: LayoutDef = {
  type: 'poster',
  label: 'Poster',
  defaults: {
    title: 'A headline that ==lands==.',
    body: 'Two or three calm sentences that carry the supporting thought, anchored to the floor of the slide.',
    label: 'A quiet label over the visual',
    image: '',
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <div className="slide full">
        <div
          className={
            'poster' +
            (slide.props.flip ? ' flip' : '') +
            (slide.props.inset ? ' inset' : '')
          }
        >
          <div className="poster-body">
            <h2 className="headline poster-title">
              <T path="title" placeholder="Headline" />
            </h2>
            {show(slide.props.body) && (
              <div className="lead poster-caption">
                <T path="body" placeholder="Supporting copy" block />
              </div>
            )}
          </div>
          <div className="poster-media">
            {slide.props.image ? (
              <img src={slide.props.image} alt="" />
            ) : (
              <div className="poster-wash" aria-hidden />
            )}
            {show(slide.props.label) && (
              <div className="kicker poster-label">
                <T path="label" placeholder="Label" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
};

const StoryDef: LayoutDef = {
  type: 'story',
  label: 'Story',
  defaults: {
    kicker: 'A SMALL LABEL UP HERE',
    title: 'A headline that makes\nthe ==argument==.',
    pair: true,
    body: 'A fuller paragraph than most slides get — four or five sentences that earn their space by telling one story properly, with the visual holding the other half of the slide.',
    image: '',
  },
  Render: ({ slide }) => {
    const show = useShow();
    const pair = slide.props.pair !== false;
    const img = (url: string | undefined) => (
      <div className="story-img">
        {url ? (
          <img src={url} alt="" />
        ) : (
          <div className="poster-wash" aria-hidden />
        )}
      </div>
    );

    return (
      <div className="slide full">
        <div className={'story' + (slide.props.flip ? ' flip' : '')}>
          <div className="story-body">
            {show(slide.props.kicker) && (
              <div className="kicker story-kicker">
                <T path="kicker" placeholder="Kicker" />
              </div>
            )}
            <h2 className="headline story-title">
              <T path="title" placeholder="Headline" />
            </h2>
            {show(slide.props.body) && (
              <div className="story-copy">
                <T path="body" placeholder="Body" block />
              </div>
            )}
          </div>
          <div className="story-media">
            {img(slide.props.image)}
            {pair && img(slide.props.image2)}
          </div>
        </div>
      </div>
    );
  },
};

const PersonaDef: LayoutDef = {
  type: 'persona',
  label: 'Persona',
  defaults: {
    title: 'Meet a person,\ntheir role,\nat their company.',
    body: 'Tell the story that makes them real: what they were trying to do, what stood in the way, and what it was costing them before things changed.',
    label: 'THE OPPORTUNITY',
    image: '',
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <div className="slide full">
        <div className={'persona' + (slide.props.flip ? ' flip' : '')}>
          <div className="persona-media">
            {slide.props.image ? (
              <img src={slide.props.image} alt="" />
            ) : (
              <div className="poster-wash" aria-hidden />
            )}
          </div>
          <div className="persona-body">
            <h2 className="headline persona-title">
              <T path="title" placeholder="Headline" />
            </h2>
            {show(slide.props.body) && (
              <div className="persona-copy">
                <T path="body" placeholder="Story" block />
              </div>
            )}
            {show(slide.props.label) && (
              <div className="kicker persona-label">
                <T path="label" placeholder="Label" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
};

const SpeakerDef: LayoutDef = {
  type: 'speaker',
  label: 'Speaker',
  defaults: {
    label: "TODAY'S SPEAKER",
    name: 'Firstname Lastname',
    role: 'ROLE, TEAM\nAT COMPANY',
    bio: 'Three or four sentences of biography: what they lead, how long they have done it, and the one thing the audience should know before they start speaking.',
    image: '',
  },
  Render: ({ slide }) => {
    const show = useShow();

    return (
      <div className="slide full">
        <div className={'speaker' + (slide.props.flip ? ' flip' : '')}>
          <div className="speaker-body">
            {show(slide.props.label) && (
              <div className="kicker speaker-label">
                <T path="label" placeholder="Label" />
              </div>
            )}
            <div className="speaker-who">
              <h2 className="headline speaker-name">
                <T path="name" placeholder="Name" />
              </h2>
              {show(slide.props.role) && (
                <div className="kicker speaker-role">
                  <T path="role" placeholder="Role" block />
                </div>
              )}
            </div>
            {show(slide.props.bio) && (
              <div className="speaker-bio">
                <T path="bio" placeholder="Bio" block />
              </div>
            )}
          </div>
          <div className="speaker-media">
            {slide.props.image ? (
              <img src={slide.props.image} alt="" />
            ) : (
              <div className="poster-wash" aria-hidden />
            )}
          </div>
        </div>
      </div>
    );
  },
};

const ChartDef: LayoutDef = {
  type: 'chart',
  label: 'Chart',
  defaults: {
    kicker: 'Traction',
    title: 'Up and to the right.',
    kind: 'bars',
    bars: [
      { label: 'Q1', value: 18 },
      { label: 'Q2', value: 26 },
      { label: 'Q3', value: 41 },
      { label: 'Q4', value: 64 },
    ],
    points: '12 | 18 | 15 | 26 | 22 | 34 | 30',
    donutValue: 72,
    donutLabel: 'Adoption',
    donuts: [
      { value: 64, label: 'First segment' },
      { value: 43, label: 'Second segment' },
      { value: 81, label: 'Third segment' },
    ],
    categories: 'Jan | Mar | May | Jul | Sep',
    series: [
      { label: 'First series', values: '20 | 34 | 28 | 51 | 63' },
      { label: 'Second series', values: '12 | 22 | 31 | 38 | 44' },
    ],
    lines: [
      { label: 'First measure', points: '4 | 7 | 6 | 11 | 9 | 12' },
      { label: 'Second measure', points: '20 | 26 | 31 | 28 | 38 | 41' },
      { label: 'Third measure', points: '1.5 | 3 | 2.5 | 4.5 | 4 | 6' },
    ],
    caption: '',
  },
  Render: ({ slide }) => {
    const { editable, slideId } = useEdit();
    const setProp = useStore((s) => s.setProp);
    const show = useShow();
    const kind = slide.props.kind ?? 'bars';
    const prevKind = useRef(kind);

    useEffect(() => {
      if (!editable || !slideId) return;

      const p = slide.props;
      const from = prevKind.current;

      prevKind.current = kind;

      const barsData = asList<{
        label: string;
        value: number | string;
      }>(p.bars);
      const ptsData = pipe(p.points)
        .filter((x) => x !== '')
        .join(' | ');
      const seriesData = asList<{
        label: string;
        values: string;
      }>(p.series);
      const linesData = asList<{ label: string; points: string }>(p.lines);
      const nums = (s2: unknown) =>
        String(s2 ?? '')
          .split('|')
          .map((v) => v.trim())
          .filter((v) => v !== '');

      if (from !== kind) {
        const src: {
          labels: string[];
          rows: { label: string; values: string[] }[];
        } | null =
          from === 'bars' && barsData.length
            ? {
                labels: barsData.map((b) => b.label),
                rows: [
                  {
                    label: 'Series 1',
                    values: barsData.map((b) => String(Number(b.value) || 0)),
                  },
                ],
              }
            : from === 'line' && ptsData
            ? {
                labels: nums(ptsData).map((_, i) => `P${i + 1}`),
                rows: [{ label: 'Series 1', values: nums(ptsData) }],
              }
            : from === 'grouped' && seriesData.length
            ? {
                labels: nums(p.categories),
                rows: seriesData.map((sr) => ({
                  label: sr.label,
                  values: nums(sr.values),
                })),
              }
            : from === 'lines' && linesData.length
            ? {
                labels: nums(linesData[0].points).map((_, i) => `P${i + 1}`),
                rows: linesData.map((l) => ({
                  label: l.label,
                  values: nums(l.points),
                })),
              }
            : null;

        if (src && src.rows[0]?.values.length) {
          const first = src.rows[0].values;

          if (kind === 'bars') {
            const labels =
              barsData.length === first.length
                ? barsData.map((b) => b.label)
                : src.labels;

            setProp(
              slideId,
              'bars',
              first.map((v, i) => ({
                label: labels[i] ?? `P${i + 1}`,
                value: Number(v) || 0,
              }))
            );
          }

          if (kind === 'line') setProp(slideId, 'points', first.join(' | '));

          if (kind === 'grouped') {
            setProp(
              slideId,
              'series',
              src.rows.map((r) => ({
                label: r.label,
                values: r.values.join(' | '),
              }))
            );
            setProp(
              slideId,
              'categories',
              (src.labels.length === first.length
                ? src.labels
                : first.map((_, i) => `P${i + 1}`)
              ).join(' | ')
            );
          }

          if (kind === 'lines')
            setProp(
              slideId,
              'lines',
              src.rows.map((r) => ({
                label: r.label,
                points: r.values.join(' | '),
              }))
            );

          if (kind !== 'donut' && kind !== 'donuts') return;
        }
      }

      if (kind === 'bars' && !barsData.length)
        setProp(slideId, 'bars', structuredClone(ChartDef.defaults.bars));
      if (kind === 'line' && !ptsData)
        setProp(slideId, 'points', ChartDef.defaults.points);
      if (kind === 'donut' && p.donutValue == null) {
        setProp(slideId, 'donutValue', 72);
        setProp(slideId, 'donutLabel', p.donutLabel ?? 'Adoption');
      }
      if (kind === 'donuts' && !asList(p.donuts).length)
        setProp(slideId, 'donuts', structuredClone(ChartDef.defaults.donuts));
      if (kind === 'grouped') {
        if (!seriesData.length)
          setProp(slideId, 'series', structuredClone(ChartDef.defaults.series));
        if (!String(p.categories ?? '').trim())
          setProp(slideId, 'categories', ChartDef.defaults.categories);
      }
      if (kind === 'lines' && !linesData.length)
        setProp(slideId, 'lines', structuredClone(ChartDef.defaults.lines));
    }, [editable, slideId, kind, slide.props, setProp]);

    const large = !!slide.props.large;
    const showValues = slide.props.values !== false;
    const bars = asList<{ label: string; value: number | string }>(
      slide.props.bars
    ).map((b) => ({ label: b.label, value: Number(b.value) || 0 }));
    const barChart = (
      <BarChart
        height={large ? 340 : 240}
        showValues={showValues}
        data={bars.map((b, i) => ({
          value: b.value,
          valueNode: editable ? <T path={`bars.${i}.value`} /> : undefined,
          label: e(
            <LiCtl path="bars" index={i} blank={BAR_BLANK}>
              <T path={`bars.${i}.label`} />
            </LiCtl>
          ),
        }))}
      />
    );

    return (
      <Slide>
        <Heading slide={slide} />
        <div
          style={{
            maxWidth: large
              ? 'none'
              : kind === 'donut'
              ? 420
              : kind === 'donuts' || kind === 'grouped' || kind === 'lines'
              ? 940
              : 680,
            marginInline: 'auto',
            textAlign:
              kind === 'donut' || kind === 'donuts' ? 'center' : undefined,
            ...(slide.props.color
              ? {
                  ['--primary' as never]: slide.props.color,
                  ['--accent' as never]: slide.props.color,
                }
              : {}),
          }}
        >
          {kind === 'bars' &&
            (editable ? (
              <BarsEditor slide={slide} bars={bars}>
                {barChart}
              </BarsEditor>
            ) : (
              barChart
            ))}
          {kind === 'line' && (
            <LineChart
              showValues={showValues}
              large={large}
              points={pipe(slide.props.points)
                .map(Number)
                .filter(Number.isFinite)}
              height={large ? 340 : 240}
            />
          )}
          {kind === 'donut' && (
            <div className="chart-center">
              <DonutChart
                size={large ? 300 : 200}
                value={Number(slide.props.donutValue) || 0}
                label={e(<T path="donutLabel" />)}
              />
            </div>
          )}
          {kind === 'grouped' && (
            <GroupedBarChart
              height={large ? 350 : 250}
              showValues={showValues}
              categories={pipe(slide.props.categories)}
              series={asList<{
                label: string;
                values: string;
              }>(slide.props.series).map((s2, i) => ({
                label: e(
                  <LiCtl
                    path="series"
                    index={i}
                    blank={{ label: 'Series', values: '10 | 20 | 30' }}
                  >
                    <T path={`series.${i}.label`} />
                  </LiCtl>
                ),
                values: pipe(s2.values)
                  .map(Number)
                  .map((n) => (Number.isFinite(n) ? n : 0)),
              }))}
            />
          )}
          {kind === 'lines' && (
            <div className="lines-row">
              {asList<{ label: string; points: string }>(
                slide.props.lines
              ).map((l, i) => (
                <div key={i} className="lines-cell">
                  <LineChart
                    showValues={showValues}
                    large={large}
                    points={pipe(l.points).map(Number).filter(Number.isFinite)}
                    height={large ? 230 : 150}
                  />
                  <div className="lines-label">
                    <LiCtl
                      path="lines"
                      index={i}
                      blank={{ label: 'Measure', points: '5 | 8 | 6 | 10' }}
                    >
                      <T path={`lines.${i}.label`} />
                    </LiCtl>
                  </div>
                </div>
              ))}
            </div>
          )}
          {kind === 'donuts' && (
            <div className="donut-row">
              {asList<{ value: number; label: string }>(
                slide.props.donuts
              ).map((d, i) => (
                <div key={i} className="donut-cell">
                  <DonutChart
                    value={Number(d.value) || 0}
                    size={large ? 210 : 140}
                    label={e(
                      <LiCtl
                        path="donuts"
                        index={i}
                        blank={{ value: 50, label: 'Segment' }}
                      >
                        <T path={`donuts.${i}.label`} />
                      </LiCtl>
                    )}
                  />
                </div>
              ))}
            </div>
          )}
          {show(slide.props.caption) && (
            <div
              className="foot"
              style={{ marginTop: 18, textAlign: 'center' }}
            >
              <T path="caption" placeholder="Caption" />
            </div>
          )}
        </div>
      </Slide>
    );
  },
};

const POINT_BLANK = {
  label: 'ANOTHER POINT',
  body: 'What else the data says.',
};

const InsightDef: LayoutDef = {
  type: 'insight',
  label: 'Insight',
  defaults: {
    title: 'What the data ==says==.',
    subtitle: 'A chart is easier to trust with a title over it.',
    kind: 'donut',
    bars: [
      { label: 'Q1', value: 18 },
      { label: 'Q2', value: 26 },
      { label: 'Q3', value: 41 },
      { label: 'Q4', value: 64 },
    ],
    donutValue: 64,
    donutLabel: 'The headline figure',
    points_line: '12 | 18 | 15 | 26 | 22 | 34 | 30',
    heading: 'A bit more context',
    points: [
      {
        label: 'THE FIRST POINT',
        body: 'What does this chart tell you? One sentence of interpretation.',
      },
      {
        label: 'THE SECOND POINT',
        body: 'Something else that stands out about the data.',
      },
      {
        label: 'ONE FINAL POINT',
        body: 'Synthesize the findings or draw the conclusion.',
      },
    ],
  },
  Render: ({ slide }) => {
    const { editable, slideId } = useEdit();
    const setProp = useStore((s) => s.setProp);
    const show = useShow();
    const kind = slide.props.kind ?? 'donut';
    const prevKind = useRef(kind);

    useEffect(() => {
      if (!editable || !slideId) return;

      const p = slide.props;
      const from = prevKind.current;

      prevKind.current = kind;

      const bd = asList<{ label: string; value: number | string }>(p.bars);
      const pl = pipe(p.points_line)
        .filter((x) => x !== '')
        .join(' | ');

      if (from !== kind && from === 'bars' && kind === 'line' && bd.length) {
        setProp(
          slideId,
          'points_line',
          bd.map((b) => Number(b.value) || 0).join(' | ')
        );
      } else if (from !== kind && from === 'line' && kind === 'bars' && pl) {
        const vals = pl.split('|').map((v: string) => v.trim());
        const labels =
          bd.length === vals.length
            ? bd.map((b) => b.label)
            : vals.map((_, i: number) => `P${i + 1}`);

        setProp(
          slideId,
          'bars',
          vals.map((v: string, i: number) => ({
            label: labels[i],
            value: Number(v) || 0,
          }))
        );
      } else {
        if (kind === 'bars' && !bd.length)
          setProp(slideId, 'bars', structuredClone(InsightDef.defaults.bars));
        if (kind === 'line' && !pl)
          setProp(slideId, 'points_line', InsightDef.defaults.points_line);
      }

      if (kind === 'donut' && p.donutValue == null) {
        setProp(slideId, 'donutValue', 64);
        setProp(slideId, 'donutLabel', p.donutLabel ?? 'The headline figure');
      }
    }, [editable, slideId, kind, slide.props, setProp]);

    const bars = asList<{ label: string; value: number | string }>(
      slide.props.bars
    ).map((b) => ({ label: b.label, value: Number(b.value) || 0 }));
    const showValues = slide.props.values !== false;
    const chart =
      kind === 'bars' ? (
        <BarChart
          height={230}
          showValues={showValues}
          data={bars.map((b, i) => ({
            value: b.value,
            valueNode: editable ? <T path={`bars.${i}.value`} /> : undefined,
            label: e(<T path={`bars.${i}.label`} />),
          }))}
        />
      ) : kind === 'line' ? (
        <LineChart
          showValues={showValues}
          points={pipe(slide.props.points_line)
            .map(Number)
            .filter(Number.isFinite)}
          height={230}
        />
      ) : (
        <DonutChart
          value={Number(slide.props.donutValue) || 0}
          size={200}
          label={e(<T path="donutLabel" />)}
        />
      );

    return (
      <div className="slide full">
        <div
          className="insight"
          style={
            slide.props.color
              ? {
                  ['--primary' as never]: slide.props.color,
                  ['--accent' as never]: slide.props.color,
                }
              : undefined
          }
        >
          <div className="insight-chart">
            <h2 className="headline insight-title">
              <T path="title" placeholder="Title" />
            </h2>
            {show(slide.props.subtitle) && (
              <div className="insight-sub">
                <T path="subtitle" placeholder="Chart subtitle" />
              </div>
            )}
            <div
              className={'insight-viz' + (kind === 'donut' ? ' center' : '')}
            >
              {editable && kind === 'bars' ? (
                <BarsEditor slide={slide} bars={bars}>
                  {chart}
                </BarsEditor>
              ) : (
                chart
              )}
            </div>
          </div>
          <div className="insight-points">
            {show(slide.props.heading) && (
              <h3 className="insight-heading">
                <T path="heading" placeholder="Heading" />
              </h3>
            )}
            {asList<{ label: string }>(slide.props.points).map((_, i) => (
              <div key={i} className="insight-point">
                <div className="kicker insight-point-label">
                  <LiCtl path="points" index={i} blank={POINT_BLANK}>
                    <T path={`points.${i}.label`} />
                  </LiCtl>
                </div>
                <div className="insight-point-body">
                  <T path={`points.${i}.body`} block />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  },
};

export const mediaLayouts = [
  PosterDef,
  StoryDef,
  SpeakerDef,
  PersonaDef,
  ChartDef,
  InsightDef,
];
