/* Opening the deck's own views (present, the presenter console).

   A new window is the right answer when this app owns a browser tab: the deck
   goes up on the projector while the editor stays where it was. It is the wrong
   answer when the app is framed — a Bolt preview, a docs page — because the URL
   in that frame is only resolvable by the tab that is connected to the running
   project. A second tab pointed at it gets a "connect to project" screen and
   then nothing to connect to, so presenting from the preview pane has to happen
   in the frame it was given. */

/** True when the app is running inside a frame rather than owning its tab. */
export const embedded = window.self !== window.top;

export function openView(href: string, name: string) {
  if (embedded) window.location.assign(href);
  else window.open(href, name);
}
