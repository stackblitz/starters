export type TextScale = 'lg' | 'xl';

type Scaled<T> = T & { scale?: TextScale };

export type CardSurface =
  | { type: 'color'; color: string }
  | { type: 'gradient'; from: string; to: string; angle?: number };

export type BarDatum = { label: string; value: number };
export type DonutDatum = { value: number; label: string };
export type GroupedSeries = { label: string; values: string };
export type LineSeries = { label: string; points: string };
export type InsightTakeaway = { label: string; body: string };

export type CoverProps = Scaled<{
  kicker: string;
  title: string;
  subtitle?: string;
  image?: string;
  dim?: number;
  foot?: string;
}>;

export type SectionProps = Scaled<{
  n: number;
  kicker: string;
  title: string;
  image?: string;
  dim?: number;
}>;

export type StatementProps = Scaled<{
  kicker?: string;
  title: string;
  body?: string;
}>;

export type BigNumberProps = Scaled<{
  kicker?: string;
  value: string;
  caption: string;
  foot?: string;
}>;

export type ManifestoProps = Scaled<{
  label: string;
  text: string;
}>;

export type QuoteProps = Scaled<{
  text: string;
  name?: string;
  role?: string;
  img?: string;
  image?: string;
  dim?: number;
}>;

export type AgendaProps = Scaled<{
  kicker?: string;
  title?: string;
  items: { title: string; hint?: string }[];
}>;

export type StepsProps = Scaled<{
  kicker?: string;
  title?: string;
  items: { title: string; body?: string }[];
}>;

export type PillarsProps = Scaled<{
  title: string;
  items: { title: string; body: string }[];
  large?: boolean;
}>;

export type TimelineProps = Scaled<{
  kicker?: string;
  title?: string;
  items: { time: string; title: string; body?: string }[];
}>;

export type ContrastProps = Scaled<{
  kicker?: string;
  title?: string;
  left: { label: string; title: string; points: string[] };
  right: { label: string; title: string; points: string[] };
}>;

export type ComparisonProps = Scaled<{
  kicker?: string;
  title?: string;
  cols: string[];
  highlight: number;
  rows: { label: string; values: Array<boolean | string> }[];
}>;

export type TableProps = Scaled<{
  kicker?: string;
  title?: string;
  columns: string[];
  rows: string[][];
  highlightCol?: number;
  caption?: string;
  filled?: boolean;
  large?: boolean;
  labelLeft?: string;
}>;

export type TabsProps = Scaled<{
  kicker?: string;
  title?: string;
  tabs: { label: string; content: string }[];
}>;

export type AccordionProps = Scaled<{
  kicker?: string;
  title?: string;
  items: { title: string; body: string }[];
}>;

export type QaProps = Scaled<{
  title: string;
  items: { q: string; a: string }[];
  large?: boolean;
}>;

export type PricingProps = Scaled<{
  kicker?: string;
  title?: string;
  tiers: {
    name: string;
    price: string;
    period?: string;
    blurb?: string;
    features: string[];
    highlight?: boolean;
    badge?: string;
  }[];
}>;

export type TeamProps = Scaled<{
  kicker?: string;
  title?: string;
  people: { name: string; role?: string; img?: string }[];
}>;

/** `items` is a pipe-delimited marquee: "Acme | Northwind | Globex". */
export type LogosProps = Scaled<{
  kicker?: string;
  title?: string;
  items: string;
}>;

export type BentoTile = {
  k?: string;
  fig?: string;
  title?: string;
  body?: string;
  c: number;
  r: number;
  variant?: 'accent' | 'glow';
  img?: string;
};

export type BentoProps = Scaled<{
  kicker?: string;
  title?: string;
  tiles: BentoTile[];
}>;

export type StatGridProps = Scaled<{
  kicker?: string;
  title?: string;
  stats: { value: string; label: string; caption?: string }[];
}>;

export type FiguresProps = Scaled<{
  title: string;
  body?: string;
  items: { label: string; value: string; caption?: string }[];
  cards?: boolean;
  cardBg?: CardSurface;
}>;

export type PosterProps = Scaled<{
  title: string;
  body: string;
  label: string;
  image?: string;
  inset?: boolean;
  flip?: boolean;
}>;

export type StoryProps = Scaled<{
  kicker: string;
  title: string;
  body: string;
  /** Default true: two portraits. */
  pair?: boolean;
  image?: string;
  image2?: string;
  flip?: boolean;
}>;

export type SpeakerProps = Scaled<{
  label: string;
  name: string;
  role: string;
  bio: string;
  image?: string;
  flip?: boolean;
}>;

export type PersonaProps = Scaled<{
  title: string;
  body: string;
  label: string;
  image?: string;
  flip?: boolean;
}>;

type ChartShared = Scaled<{
  kicker?: string;
  title?: string;
  color?: string;
  large?: boolean;
  /** `false` hides data-point figures. */
  values?: boolean;
  caption?: string;
}>;

export type ChartProps = ChartShared &
  (
    | { kind: 'bars'; bars: BarDatum[] }
    | { kind: 'line'; points: string }
    | { kind: 'donut'; donutValue: number; donutLabel: string }
    | { kind: 'donuts'; donuts: DonutDatum[] }
    | { kind: 'grouped'; categories: string; series: GroupedSeries[] }
    | { kind: 'lines'; lines: LineSeries[] }
  );

type InsightShared = Scaled<{
  title: string;
  subtitle?: string;
  color?: string;
  heading?: string;
  points: InsightTakeaway[];
  values?: boolean;
}>;

export type InsightProps = InsightShared &
  (
    | { kind: 'bars'; bars: BarDatum[] }
    | { kind: 'line'; points_line: string }
    | { kind: 'donut'; donutValue: number; donutLabel: string }
  );

export type ChatProps = Scaled<{
  kicker?: string;
  title?: string;
  name: string;
  messages: { from: 'user' | 'ai'; text: string }[];
}>;

export type CodeProps = Scaled<{
  kicker?: string;
  title?: string;
  filename: string;
  code: string;
  highlight?: string;
}>;

export const LAYOUT_NAMES = [
  'cover',
  'section',
  'statement',
  'bigNumber',
  'manifesto',
  'quote',
  'agenda',
  'steps',
  'pillars',
  'timeline',
  'contrast',
  'comparison',
  'table',
  'tabs',
  'accordion',
  'qa',
  'pricing',
  'team',
  'logos',
  'bento',
  'statGrid',
  'figures',
  'poster',
  'story',
  'speaker',
  'persona',
  'chart',
  'insight',
  'chat',
  'code',
] as const;

export type LayoutName = (typeof LAYOUT_NAMES)[number];

export interface LayoutPropsByName {
  cover: CoverProps;
  section: SectionProps;
  statement: StatementProps;
  bigNumber: BigNumberProps;
  manifesto: ManifestoProps;
  quote: QuoteProps;
  agenda: AgendaProps;
  steps: StepsProps;
  pillars: PillarsProps;
  timeline: TimelineProps;
  contrast: ContrastProps;
  comparison: ComparisonProps;
  table: TableProps;
  tabs: TabsProps;
  accordion: AccordionProps;
  qa: QaProps;
  pricing: PricingProps;
  team: TeamProps;
  logos: LogosProps;
  bento: BentoProps;
  statGrid: StatGridProps;
  figures: FiguresProps;
  poster: PosterProps;
  story: StoryProps;
  speaker: SpeakerProps;
  persona: PersonaProps;
  chart: ChartProps;
  insight: InsightProps;
  chat: ChatProps;
  code: CodeProps;
}

export type LayoutProps = LayoutPropsByName[LayoutName];
