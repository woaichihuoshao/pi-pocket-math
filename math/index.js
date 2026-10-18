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
 *
 * Cost while a reply streams in: only the text nodes that were just added are examined, and only when they carry a
 * dollar or `\(`/`\[` at all. A block is never re-scanned as a whole, so a long answer costs the same per chunk however
 * long it gets.
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

/** Whether a text node can hold anything this module renders: a cheap check before the real one. */
function mightHoldMath(text) {
  return text.includes("$") || text.includes("\\(") || text.includes("\\[");
}

/** Whether a node sits where math is not rendered (code, a link, an existing formula, an editor). */
function offLimits(node) {
  const parent = node.parentElement;

  return (
    parent === null ||
    parent.closest("code, pre, a, textarea, .math-inline, .math-display") !==
      null
  );
}

/** One text node's math, as a fragment: the text before, the formula, the text after. */
function renderIn(node, temml) {
  const text = node.nodeValue ?? "";

  if (!mightHoldMath(text)) {
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

/**
 * Render the math a subtree holds, visiting only its text nodes. Called with what a mutation just added, so the work
 * is proportional to the new chunk and never to the whole reply.
 */
function renderTree(root, temml) {
  if (root.nodeType === Node.TEXT_NODE) {
    if (offLimits(root)) {
      return;
    }

    const rendered = renderIn(root, temml);

    if (rendered !== null) {
      root.replaceWith(rendered);
    }

    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  // A whole formula, or code: nothing inside is ours.
  if (root.matches("code, pre, a, textarea, .math-inline, .math-display")) {
    return;
  }

  // The common case in a reply: one line of text in a `<p>`, with no dollar anywhere.
  if (
    root.childNodes.length === 1 &&
    root.firstChild.nodeType === Node.TEXT_NODE
  ) {
    if (
      root.firstChild.nodeValue?.includes("$") === true ||
      mightHoldMath(root.firstChild.nodeValue ?? "")
    ) {
      const rendered = renderIn(root.firstChild, temml);

      if (rendered !== null) {
        root.firstChild.replaceWith(rendered);
      }
    }

    return;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (offLimits(node)) {
        return NodeFilter.FILTER_REJECT;
      }

      return mightHoldMath(node.nodeValue ?? "")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
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

export default function setup(pocket) {
  // A stylesheet of our own: display math centered on its own line.
  pocket.style("math.css");

  void loadTemml()
    .then((temml) => {
      if (temml === undefined) {
        return;
      }

      // What was on the page before the observer: once, in full.
      renderTree(document.body, temml);

      // Replies stream in: only the nodes that just arrived are examined, so a long answer costs the same per chunk.
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            renderTree(node, temml);
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    })
    .catch(() => {
      // No engine: replies keep their LaTeX as text, which is the state before this module.
    });
}
