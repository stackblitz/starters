import Reveal from '../deck/Reveal';

/* A pull-quote slide: an accent quotation mark, the quote at display scale,
   and an attribution row with a photo or auto-initials avatar (`img`). Pass
   `image` for a full-bleed background photo under a scrim (brand decks).
   Don't wrap the text in quotation marks — the mark provides them.
   <Quote text="It changed how we ship." name="Dana Kim" role="VP Engineering, Acme" /> */
export default function Quote({
  text,
  name,
  role,
  img,
  image,
}: {
  text: string;
  name?: string;
  role?: string;
  img?: string;
  image?: string;
  nav?: string;
  notes?: string;
}) {
  const initials = name
    ? name
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';
  return (
    <div className="slide center">
      {image && (
        <>
          <img className="cover-img" src={image} alt="" aria-hidden />
          <div className="cover-scrim" aria-hidden />
        </>
      )}
      <Reveal>
        <div className="quote-mark" aria-hidden>
          “
        </div>
      </Reveal>
      <Reveal delay={0.08}>
        <p
          className="quote-text"
          style={{ marginTop: 'clamp(14px,2.5vh,24px)' }}
        >
          {text}
        </p>
      </Reveal>
      {name && (
        <Reveal delay={0.18}>
          <div className="quote-attr">
            <span className="quote-ava">
              {img ? <img src={img} alt={name} /> : initials}
            </span>
            <span className="quote-who">
              <div className="quote-name">{name}</div>
              {role && <div className="quote-role">{role}</div>}
            </span>
          </div>
        </Reveal>
      )}
    </div>
  );
}
