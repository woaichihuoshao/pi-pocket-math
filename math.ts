/**
 * Math: renders LaTeX in Pi's replies — `$…$` inline, `$$…$$` on its own line — as MathML the browser draws itself.
 * No font to ship, no stylesheet, no CDN: the engine (Temml, MIT) is served from this drop-in's own folder, which is
 * what the app's policy allows. Inside code, links, and preformatted text nothing is touched, and an inline `$…$` must
 * look like math (a backslash, `^`, `_`, `=`, or braces) so "$5 and $10" stays a price.
 */
import type { Web } from "./_pocket.d.ts";

/** What this module uses from the host: nothing. It only adds a browser module. */
type Host = Record<string, never>;

export default function createMath(_host: Host, web: Web) {
  web.client("math");
}
