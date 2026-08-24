import Build from '../deck/Build';
import Reveal from '../deck/Reveal';

/* A chat-conversation slide — user bubbles on the accent, assistant bubbles on
   the surface, inside a titled window. Each message is a click-build beat:
   advance the deck (→ / space) to reveal the exchange line by line. Ideal for
   AI-product decks.
   <Chat kicker="Ask anything" title="Plain English in, answers out."
     name="Acme" messages={[
       { from: 'user', text: 'Why did signups dip last week?' },
       { from: 'ai', text: 'Signups fell 12% after Tuesday's pricing change…' },
     ]} /> */
export type ChatMessage = { from: 'user' | 'ai'; text: string };

export default function Chat({
  kicker,
  title,
  name = 'Assistant',
  messages,
}: {
  kicker?: string;
  title?: string;
  name?: string;
  messages: ChatMessage[];
  nav?: string;
  notes?: string;
}) {
  return (
    <div className="slide">
      <div className="container">
        <Reveal>
          {kicker && (
            <div
              className="kicker"
              style={{ marginBottom: 10, textAlign: 'center' }}
            >
              {kicker}
            </div>
          )}
          {title && (
            <h2
              className="headline"
              style={{
                textAlign: 'center',
                marginInline: 'auto',
                marginBottom: 'clamp(22px,3.5vh,36px)',
              }}
            >
              {title}
            </h2>
          )}
        </Reveal>
        <Reveal delay={0.1}>
          <div className="chat mat">
            <div className="chat-head">
              <span className="ddot" />
              {name}
            </div>
            <div className="chat-body">
              {messages.map((m, i) => (
                <Build key={i} at={i + 1} className={'msg ' + m.from} y={10}>
                  {m.text}
                </Build>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
