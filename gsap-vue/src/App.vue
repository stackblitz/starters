<script>
import { onMounted, onUnmounted, ref } from 'vue';
import gsap from 'gsap';

export default {
  setup() {
    const main = ref();
    const ctx = ref();

    onMounted(() => {
      ctx.value = gsap.context((self) => {
        const boxes = self.selector('.box');
        boxes.forEach((box) => {
          gsap.to(box, {
            x: 150,
            scrollTrigger: {
              trigger: box,
              start: 'bottom bottom',
              end: 'top 20%',
              scrub: true,
            },
          });
        });
      }, main.value); // <- Scope!
    });

    onUnmounted(() => {
      ctx.value.revert(); // <- Easy Cleanup!
    });

    return { main };
  },
};
</script>

<template>
  <div>
    <header>
      <a href="https://greensock.com/scrolltrigger">
        <img
          class="greensock-icon"
          src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/16327/scroll-trigger-logo-light.svg"
          width="200"
          height="64"
        />
      </a>
    </header>
    <section class="section flex-center column blue">
      <h1>Basic ScrollTrigger in VueJS</h1>
      <h2>Scroll down to see the magic happen!!</h2>
    </section>
    <div class="section flex-center column" ref="main">
      <div class="box">box</div>
      <div class="box">box</div>
      <div class="box">box</div>
    </div>
    <section class="section flex-center orange column">
      <h1>The End!</h1>
      <h2>
        For more information visit:&nbsp;
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
</template>
