import Deck from './deck/Deck'
import Slide from './deck/Slide'
import Build from './deck/Build'
import Reveal from './deck/Reveal'
import Bento from './components/Bento'
import Split from './components/Split'
import CountUp from './components/CountUp'
import TiltCard from './components/TiltCard'
import Marquee from './components/Marquee'
import VisualDashboard from './components/VisualDashboard'
import StatGrid from './components/StatGrid'
import Accordion from './components/Accordion'
import Comparison from './components/Comparison'
import Tabs from './components/Tabs'
import Timeline from './components/Timeline'
import CodeWindow from './components/CodeWindow'
import BrowserFrame from './components/BrowserFrame'
import SpotlightCard from './components/SpotlightCard'
import { BarChart, LineChart, DonutChart } from './components/Charts'

/* ══════════════════════════════════════════════════════════════════════
   ⚠️  THROWAWAY DEMO showing every component. DELETE these slides and AUTHOR
   THE USER'S DECK. Each child of <Deck> is one slide. Add speaker notes with
   notes="…" on any slide (shown in presenter mode — press P). (A = auto-play.)
   ══════════════════════════════════════════════════════════════════════ */
const panel = (extra = 0.22): React.CSSProperties => ({ position: 'absolute', inset: 0, background: `radial-gradient(120% 100% at 30% 20%, color-mix(in srgb, var(--primary) ${extra * 100}%, transparent), transparent 60%), var(--surface-2)` })
const card: React.CSSProperties = { padding: 22, borderRadius: 'var(--radius)', background: 'var(--surface)', border: '1px solid var(--hair)' }

export default function App() {
  return (
    <Deck>
      {/* Cover */}
      <Slide center nav="Cover" notes="Welcome — introduce yourself, then set up the problem. Hold a beat on this slide.">
        <Reveal>
          <div className="kicker" style={{ marginBottom: 14 }}>Helix · Component demo</div>
          <h1 className="display"><span className="accent-text">Helix</span></h1>
          <p className="subhead" style={{ marginTop: 18 }}>A responsive React deck engine. Delete this and build the real one.</p>
        </Reveal>
      </Slide>

      {/* Statement + click-build */}
      <Slide center nav="Thesis" notes="Pause before revealing the second line. The whole pitch hangs on this contrast.">
        <h2 className="headline" style={{ fontSize: 'clamp(34px,5.5vw,68px)', marginInline: 'auto' }}>
          Dashboards are everywhere. <span className="accent-text">Insight isn't.</span>
        </h2>
        <Build at={1}>
          <p className="subhead" style={{ marginTop: 20 }}>Helix turns raw events into answers — automatically.</p>
        </Build>
      </Slide>

      {/* Split feature */}
      <Split
        nav="Realtime"
        notes="Emphasize sub-second latency. Point at the live chart while you talk."
        kicker="Realtime"
        title={<>Everything, <span className="accent-text">as it happens.</span></>}
        body="Live metrics with sub-second latency — no pipelines to babysit."
        media={<><div style={panel(0.22)} /><div style={{ position: 'relative', padding: 40 }}><TiltCard><VisualDashboard /></TiltCard></div></>}
      />

      {/* Bento */}
      <Bento
        nav="Platform"
        notes="Don't read every tile — let them scan. Land on throughput and uptime."
        kicker="One platform"
        title="Everything in one place."
        tiles={[
          { k: 'Throughput', fig: <CountUp to={9.4} decimals={1} suffix="M" />, body: 'events / min at peak.', c: 5, r: 2, variant: 'glow' },
          { k: 'Uptime', fig: <CountUp to={99.99} decimals={2} suffix="%" />, c: 4 },
          { k: 'Regions', fig: <CountUp to={28} />, c: 3, variant: 'accent' },
          { k: 'Connectors', title: '120+ native', body: 'Snowflake, Kafka, dbt…', c: 4 },
          { k: 'Compliance', title: 'SOC 2 · HIPAA', c: 3 },
        ]}
      />

      {/* StatGrid — traction */}
      <StatGrid
        nav="Traction"
        notes="These are the headline numbers investors remember. Say ARR is up 3× out loud."
        kicker="Traction"
        title="Numbers that compound."
        stats={[
          { value: <CountUp to={4.2} decimals={1} prefix="$" suffix="M" />, label: 'ARR', caption: 'up 3× year over year' },
          { value: <CountUp to={92} suffix="%" />, label: 'Net retention', caption: 'best in class' },
          { value: <CountUp to={120} suffix="+" />, label: 'Enterprise logos', caption: 'across six industries' },
        ]}
      />

      {/* Comparison */}
      <Slide nav="Comparison" notes="Lead with realtime. If they push on price, point at the highlighted column.">
        <Reveal>
          <div className="kicker" style={{ marginBottom: 12, textAlign: 'center' }}>Why teams switch</div>
          <h2 className="headline" style={{ textAlign: 'center', marginInline: 'auto', marginBottom: 'clamp(22px,4vh,38px)' }}>The honest comparison.</h2>
        </Reveal>
        <Reveal>
          <div style={{ maxWidth: 820, marginInline: 'auto' }}>
            <Comparison
              cols={['', 'Helix', 'Legacy tools']}
              highlight={0}
              rows={[
                { label: 'Realtime by default', values: [true, false] },
                { label: 'Self-host option', values: [true, false] },
                { label: 'Time to first insight', values: ['5 min', '2 weeks'] },
                { label: 'Starting price', values: ['$29', '$99'] },
              ]}
            />
          </div>
        </Reveal>
      </Slide>

      {/* Tabs */}
      <Slide nav="Use cases" notes="Click through the tabs as you speak to each team. Stop on the one that fits the room.">
        <Reveal>
          <div className="kicker" style={{ marginBottom: 12, textAlign: 'center' }}>One platform</div>
          <h2 className="headline" style={{ textAlign: 'center', marginInline: 'auto', marginBottom: 'clamp(20px,3vh,30px)' }}>Built for every team.</h2>
        </Reveal>
        <Reveal style={{ textAlign: 'center', maxWidth: 780, marginInline: 'auto' }}>
          <Tabs tabs={[
            { label: 'Engineering', content: <p className="lead" style={{ margin: 0 }}>Trace any request end-to-end, alert on anomalies, ship with confidence.</p> },
            { label: 'Data', content: <div style={{ height: 180 }}><BarChart data={[{ label: 'Mon', value: 38 }, { label: 'Tue', value: 55 }, { label: 'Wed', value: 47 }, { label: 'Thu', value: 72 }, { label: 'Fri', value: 90 }]} height={180} /></div> },
            { label: 'Ops', content: <p className="lead" style={{ margin: 0 }}>One source of truth for uptime, cost, and capacity — no spreadsheets.</p> },
          ]} />
        </Reveal>
      </Slide>

      {/* Split + code */}
      <Split
        nav="Developer-first"
        notes="Three lines, no schema. If there's an engineer in the room, this is the slide for them."
        kicker="Developer-first"
        title={<>Drop-in <span className="accent-text">simple.</span></>}
        body="Add it to your app in three lines. No SDK to learn, no schema to define."
        media={<><div style={panel(0.16)} /><div style={{ position: 'relative', padding: 36, width: '100%' }}>
          <CodeWindow title="app.ts" highlight={[3]} code={`import { track } from '@helix/sdk'

track('signup', {
  plan: 'pro',
  source: 'landing',
})`} />
        </div></>}
      />

      {/* Browser frame */}
      <Slide center nav="Product" notes="Demo the real thing if you can. Otherwise walk the screen top to bottom.">
        <Reveal>
          <div className="kicker" style={{ marginBottom: 14 }}>See it live</div>
          <h2 className="headline" style={{ fontSize: 'clamp(30px,4.4vw,52px)', marginInline: 'auto', marginBottom: 'clamp(18px,3vh,28px)' }}>Your data, one screen.</h2>
        </Reveal>
        <Reveal>
          <div style={{ maxWidth: 800, marginInline: 'auto', width: '100%' }}>
            <BrowserFrame url="app.helix.io">
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', minHeight: 372 }}>
                <div style={{ borderRight: '1px solid var(--hair-2)', background: 'var(--surface)', padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="kicker" style={{ marginBottom: 12, paddingLeft: 8 }}>Helix</div>
                  {['Overview', 'Events', 'Funnels', 'Cohorts', 'Settings'].map((n, i) => (
                    <div key={n} style={{ padding: '8px 12px', borderRadius: 9, fontSize: 14, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? 'var(--accent-ink)' : 'var(--fg-muted)', background: i === 0 ? 'var(--accent)' : 'transparent' }}>{n}</div>
                  ))}
                </div>
                <div style={{ padding: '20px 24px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>Overview</h3>
                    <span className="foot">Last 30 days</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                    {[['Revenue', '$1.24M', '▲ 18.2%'], ['Active users', '48,210', '▲ 9.4%'], ['Churn', '1.9%', '▼ 0.6%']].map(([l, v, d]) => (
                      <div key={l} style={{ ...card, padding: 14 }}><div className="foot" style={{ marginBottom: 5 }}>{l}</div><div style={{ fontSize: 23, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{v}</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginTop: 4 }}>{d}</div></div>
                    ))}
                  </div>
                  <div style={{ ...card, padding: 16 }}><LineChart points={[12, 16, 14, 22, 26, 34, 30, 44]} height={120} /></div>
                </div>
              </div>
            </BrowserFrame>
          </div>
        </Reveal>
      </Slide>

      {/* Charts */}
      <Slide nav="Metrics" notes="Net retention at 94% is the one to call out — it means the product sells itself.">
        <Reveal>
          <div className="kicker" style={{ marginBottom: 12, textAlign: 'center' }}>The numbers</div>
          <h2 className="headline" style={{ textAlign: 'center', marginInline: 'auto', marginBottom: 'clamp(22px,4vh,38px)' }}>Growth you can see.</h2>
        </Reveal>
        <Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 0.8fr', gap: 20, alignItems: 'stretch' }}>
            <div style={card}><div className="kicker" style={{ marginBottom: 14 }}>Weekly active</div><div style={{ height: 150 }}><BarChart data={[{ label: 'W1', value: 30 }, { label: 'W2', value: 44 }, { label: 'W3', value: 39 }, { label: 'W4', value: 61 }, { label: 'W5', value: 78 }, { label: 'W6', value: 96 }]} height={150} /></div></div>
            <div style={card}><div className="kicker" style={{ marginBottom: 14 }}>Revenue</div><LineChart points={[12, 16, 14, 22, 26, 34, 30, 44]} height={150} /></div>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><DonutChart value={94} label="Net retention" size={150} /></div>
          </div>
        </Reveal>
      </Slide>

      {/* Timeline */}
      <Slide nav="Roadmap" notes="Anchor on 'Now'. The AI insights line is what gets people excited — dwell there.">
        <Reveal>
          <div className="kicker" style={{ marginBottom: 12, textAlign: 'center' }}>Where we're going</div>
          <h2 className="headline" style={{ textAlign: 'center', marginInline: 'auto', marginBottom: 'clamp(20px,3vh,32px)' }}>The roadmap.</h2>
        </Reveal>
        <div style={{ maxWidth: 560, marginInline: 'auto' }}>
          <Timeline items={[
            { time: 'Shipped', title: 'Realtime core', body: 'Sub-second metrics across 28 regions.' },
            { time: 'Now', title: 'AI insights', body: 'Plain-English answers from your data.' },
            { time: 'Next', title: 'Enterprise', body: 'SSO, audit logs, and on-prem.' },
          ]} />
        </div>
      </Slide>

      {/* Spotlight principles */}
      <Slide nav="Principles" notes="Hover the cards for the glow if presenting on a screen. Keep this one short.">
        <Reveal>
          <div className="kicker" style={{ marginBottom: 12, textAlign: 'center' }}>What we believe</div>
          <h2 className="headline" style={{ textAlign: 'center', marginInline: 'auto', marginBottom: 'clamp(22px,4vh,38px)' }}>Three principles.</h2>
        </Reveal>
        <Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {[
              { k: '01', t: 'Fast by default', d: 'Speed is a feature. Everything is realtime.' },
              { k: '02', t: 'Yours to own', d: 'Your data, your infra, no lock-in.' },
              { k: '03', t: 'Honest pricing', d: 'No per-seat tax. Scale without surprises.' },
            ].map((p) => (
              <SpotlightCard key={p.k}>
                <div className="kicker accent-text" style={{ marginBottom: 12 }}>{p.k}</div>
                <h3 style={{ fontSize: 'clamp(20px,2.2vw,26px)', fontWeight: 600, margin: '0 0 8px' }}>{p.t}</h3>
                <p style={{ color: 'var(--fg-muted)', fontSize: 15, margin: 0, lineHeight: 1.5 }}>{p.d}</p>
              </SpotlightCard>
            ))}
          </div>
        </Reveal>
      </Slide>

      {/* Accordion — FAQ */}
      <Slide nav="FAQ" notes="Only open the questions they actually ask. Skip the rest to keep momentum.">
        <Reveal>
          <div className="kicker" style={{ marginBottom: 12, textAlign: 'center' }}>Common questions</div>
          <h2 className="headline" style={{ textAlign: 'center', marginInline: 'auto', marginBottom: 'clamp(20px,3vh,30px)' }}>Frequently asked.</h2>
        </Reveal>
        <Reveal>
          <div style={{ maxWidth: 720, marginInline: 'auto' }}>
            <Accordion items={[
              { title: 'How long does setup take?', body: 'Five minutes — point Helix at your warehouse and you are live.' },
              { title: 'Can we self-host?', body: 'Yes. A Docker image and Terraform module ship with every plan.' },
              { title: 'How is it priced?', body: 'Flat monthly, no per-seat tax — you scale without surprises.' },
            ]} />
          </div>
        </Reveal>
      </Slide>

      {/* Logos */}
      <Slide center nav="Customers" notes="Name-drop the two logos most relevant to this audience.">
        <Reveal><div className="kicker" style={{ marginBottom: 28 }}>Trusted by teams everywhere</div></Reveal>
        <Marquee items={['Northwind', 'Globex', 'Initech', 'Umbra', 'Hooli', 'Vehement', 'Soylent']} />
      </Slide>

      {/* Quote */}
      <Slide center nav="Quote" notes="Read it slowly, then stay silent for a second. Let it land.">
        <Reveal>
          <p className="headline" style={{ fontSize: 'clamp(28px,4vw,50px)', fontWeight: 500, marginInline: 'auto', maxWidth: '20ch' }}>
            “We replaced four tools with Helix and never looked back.”
          </p>
          <div className="foot" style={{ marginTop: 22 }}>— Dana Kim, VP Engineering</div>
        </Reveal>
      </Slide>

      {/* CTA */}
      <Slide center nav="Close" notes="Make the ask explicitly. Leave the contact details on screen while you take questions.">
        <Reveal>
          <h2 className="display" style={{ fontSize: 'clamp(40px,7vw,96px)' }}><span className="accent-text">Let's talk.</span></h2>
          <p className="subhead" style={{ marginTop: 16 }}>helix.io · hello@helix.io</p>
        </Reveal>
      </Slide>
    </Deck>
  )
}
