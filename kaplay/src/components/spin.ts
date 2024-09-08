export default function cmp_spin(){
  let me: any
  return {
    add() {
      me = this as any
    },
    update() {
      me.angle -= 2.222222222
    }
  }
}