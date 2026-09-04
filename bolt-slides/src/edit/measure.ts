export const offsetTo = (el: HTMLElement, anc: HTMLElement) => {
  let x = 0,
    y = 0;
  let n: HTMLElement | null = el;

  while (n && n !== anc) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }

  return { x, y };
};
