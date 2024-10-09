import cmp_spin from "../components/spin";
import k from "../kaplay";

export default function scn_starter(){

  k.add([
    k.rect(k.width(), k.height()),
    k.color(k.WHITE),
  ])

  k.add([
    k.pos(k.center()),
    k.anchor("center"),
    k.color(k.BLACK),
    k.text("Hello, Kaplay!\nEdit The Files In The 'src' Folder To Get Started\nCheck Out https://kaplayjs.com For The Documentation", {
      align: "center",
    }),
  ]);

  k.loadBean()

  let bean = k.add([
    k.sprite("bean"),
    k.pos(k.width() / 2, k.height() / 2 + 200),
    k.anchor("center"),
    k.rotate(0),
    cmp_spin(),
  ])

  k.onFixedUpdate(() => {
    bean.pos.x = Math.cos(k.time()) * 100 + k.width() / 2
    bean.pos.y = Math.sin(k.time()) * 100 + k.height() / 2 + 200
  })

}