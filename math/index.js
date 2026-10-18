/**
 * Math: renders LaTeX in Pi's replies — `$…$` inline, `$$…$$` on its own line — with MathML, which the browser draws
 * itself. No fonts to ship, no stylesheet, no CDN (the app's policy allows its own origin only).
 *
 * Why a drop-in: adding math means touching how replies are drawn, and an update to Pi Pocket must not take that away.
 * This module only adds a browser module; the LaTeX engine (Temml, MIT) sits beside it and is served from the same
 * place.
 *
 * What it skips: text inside code, preformatted blocks, links, and anything already rendered. Inline `$…$` is only
 * treated as math when it looks like math (a backslash, `^`, `_`, `=`, or braces), so "$5 and $10" stays a price.
 */
export const pocketApi = 1;

/** Load the engine beside this module, once. */
function loadTemml() {
  const existing = globalThis.temml;

  if (existing !== undefined) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");

    script.src = new URL("./temml.js", import.meta.url).href;
    script.onload = () => resolve(globalThis.temml);
    script.onerror = () => reject(new Error("temml.js did not load"));
    document.head.append(script);
  });
}

/** Whether a `$…$` body is likely math and not a price or a stray dollar. */
function looksLikeMath(body) {
  return /[\\^_={}]/.test(body);
}

/** One text node's math, as a fragment: the text before, the formula, the text after. */
function renderIn(node, temml) {
  const text = node.nodeValue ?? "";

  if (!text.includes("$") && !text.includes("\\(") && !text.includes("\\[")) {
    return null;
  }

  const pattern =
    /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
  const fragment = document.createDocumentFragment();
  let last = 0;
  let found = false;

  for (const match of text.matchAll(pattern)) {
    const whole = match[0];
    const display = match[1] ?? match[2];
    const inline = match[3] ?? match[4];
    const latex = (display ?? inline ?? "").trim();

    if (latex === "") {
      continue;
    }

    if (inline !== undefined && !looksLikeMath(latex)) {
      continue;
    }

    const at = match.index ?? 0;

    fragment.append(text.slice(last, at));

    try {
      const span = document.createElement("span");

      // `render` builds MathML nodes directly — no HTML string, so nothing from the LaTeX can inject markup.
      temml.render(latex, span, {
        displayMode: display !== undefined,
        throwOnError: false,
        trust: false,
      });

      span.className = display !== undefined ? "math-display" : "math-inline";
      fragment.append(span);
      found = true;
    } catch {
      fragment.append(whole);
    }

    last = at + whole.length;
  }

  if (!found) {
    return null;
  }

  fragment.append(text.slice(last));

  return fragment;
}

/** Render every unrendered `.md` in a subtree (`root` itself included). */
function renderAll(root, temml) {
  const blocks = [];

  if (root.nodeType === 1 && root.matches?.(".md")) {
    blocks.push(root);
  }

  if (root.querySelectorAll !== undefined) {
    blocks.push(...root.querySelectorAll(".md"));
  }

  for (const block of blocks) {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;

        if (parent === null) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.closest("code, pre, a, .math-inline, .math-display")) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];

    while (walker.nextNode() !== null) {
      nodes.push(walker.currentNode);
    }

    for (const node of nodes) {
      const rendered = renderIn(node, temml);

      if (rendered !== null) {
        node.replaceWith(rendered);
      }
    }
  }
}

export default function setup(pocket) {
  // A stylesheet of our own: display math centered on its own line.
  pocket.style("math.css");

  void loadTemml()
    .then((temml) => {
      if (temml === undefined) {
        return;
      }

      renderAll(document.body, temml);

      // Replies stream in: render each piece as it lands, never twice.
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node.nodeType === 1) {
              renderAll(node, temml);
            } else if (node.parentElement) {
              renderAll(
                node.parentElement.closest(".md") ?? node.parentElement,
                temml,
              );
            }
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    })
    .catch(() => {
      // No engine: replies keep their LaTeX as text, which is the state before this module.
    });
}
