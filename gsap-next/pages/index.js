import { useRef } from 'react';
import { gsap } from 'gsap/dist/gsap';
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger';

import { useIsomorphicLayoutEffect } from '../helpers/isomorphicEffect';

gsap.registerPlugin(ScrollTrigger);

export default function Scroll() {
  const main = useRef();

  useIsomorphicLayoutEffect(() => {
    const ctx = gsap.context((self) => {
      const boxes = self.selector('.box');
      boxes.forEach((box) => {
        gsap.to(box, {
          x: 300,
          scrollTrigger: {
            trigger: box,
            start: 'bottom bottom',
            end: 'top 20%',
            scrub: true,
          },
        });
      });
    }, main);
    return () => ctx.revert();
  }, []);

  return (
    <div>
      <header className="header">
        <a
          className="brand"
          href="https://greensock.com/scrolltrigger"
          target="_blank"
          rel="noreferrer"
        >
          <img
            className="greensock-icon"
            src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/16327/scroll-trigger-logo-light.svg"
            width="200"
            height="64"
          />
        </a>
      </header>
      <section className="section flex-center column blue">
        <h1>Basic ScrollTrigger with React</h1>
        <h2>Scroll down to see the magic happen!!</h2>
      </section>
      <div className="section flex-center column" ref={main}>
        <h1>This boxes animates as you scroll!</h1>
        <div className="box">box</div>
        <div className="box">box</div>
        <div className="box">box</div>
      </div>
      <section className="section flex-center orange column">
        <h1>The End!</h1>
        <h2>
          For more information visit:{' '}
          <a
            href="https://greensock.com/scrolltrigger/"
            target="_blank"
            rel="noreferrer"
          >
            greensock.com/scrolltrigger/
          </a>
        </h2>
      </section>
    </div>
  );
}
