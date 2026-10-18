# Math for Pi Pocket

Renders LaTeX in Pi's replies as MathML — the browser draws it itself, so nothing is fetched from anywhere.

- `$…$` or `\(…\)` — inline. Only treated as math when it looks like math (a backslash, `^`, `_`, `=`, or braces), so
  "$5 and $10" stays a price.
- `$$…$$` or `\[…\]` — on a line of its own, centered, scrolling sideways when it is too wide.

Formulas follow the theme's text color and size (slightly larger than the body), in light and dark themes alike.
Text inside code blocks, inline code, and links is left alone.

## Install

Copy `math.ts` and the `math/` folder into `~/.pi-pocket/extensions/`, then turn **Math** on in Menu → Extensions.

## Files

| File                 | What it is                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `math.ts`            | The module: registers the browser module.                                                                                        |
| `math/index.js`      | Walks `.md` blocks and renders their LaTeX, including as replies stream in.                                                      |
| `math/math.css`      | Display math on its own line, and the size of both kinds.                                                                        |
| `math/temml.js`      | [Temml](https://github.com/roniemartinez/temml) 0.14.0, a LaTeX → MathML converter. MIT. Unmodified, from the published package. |
| `math/LICENSE-temml` | Temml's license.                                                                                                                 |

## Limits

- MathML is drawn by the browser: the result follows the system's math font, not the app's monospace one.
- A formula in a **tool result**, a **diff**, or a **file viewer** is not rendered — only replies and notes are.
- `\begin{align}` and other environments Temml supports work; macros that need TeX packages do not.

## License

MIT, except `math/temml.js` and `math/LICENSE-temml`, which are Temml's (also MIT).
