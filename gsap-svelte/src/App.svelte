<script>
	import { onMount } from 'svelte';
	import gsap from 'gsap';

	console.clear();

	let boxesContainer;

	onMount(() => {
		const ctx = gsap.context((self) => {
			const boxes = self.selector('.box');
			boxes.forEach((box) => {
				gsap.to(box, {
					x: 150,
					scrollTrigger: {
						trigger: box,
						start: 'bottom bottom',
						end: 'top 20%',
						scrub: true,
					}
				});
			});
		}, boxesContainer); // <- Scope!

		return () => ctx.revert(); // <- Cleanup!
	});
</script>

<div>
	<section class="section flex-center column">
		<h1>Basic ScrollTrigger with Svelte</h1>
		<h2>Scroll down to see the magic happen!!</h2>
	</section>
	<div class="section flex-center column" bind:this={boxesContainer}>
		<div class="box">box</div>
		<div class="box">box</div>
		<div class="box">box</div>
	</div>
	<section class="section" />
</div>
