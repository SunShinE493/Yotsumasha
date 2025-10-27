import React, { useEffect, useMemo, useState } from 'react';

declare global {
  interface Window {
    katex?: any;
  }
}

let katexLoading: Promise<any> | null = null;
const KATEX_MACROS: Record<string, string> = {
  "\\ge": "\\geq",
  "\\le": "\\leq",
};
function ensureKatex(): Promise<any> {
  if (window.katex) return Promise.resolve(window.katex);
  if (katexLoading) return katexLoading;
  katexLoading = new Promise((resolve, reject) => {
    try {
      // Inject CSS
      const cssId = 'katex-css';
      if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css';
        document.head.appendChild(link);
      }
      const ensureScript = (id: string, src: string) => new Promise<void>((res, rej) => {
        if (document.getElementById(id)) return res();
        const s = document.createElement('script');
        s.id = id; s.src = src; s.async = true; s.onload = () => res(); s.onerror = rej; document.head.appendChild(s);
      });
      // Load KaTeX core, then mhchem extension for \ce
      ensureScript('katex-script', 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js')
        .then(() => ensureScript('katex-mhchem', 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/mhchem.min.js'))
        .then(() => {
          const tryReady = () => (window.katex ? resolve(window.katex) : setTimeout(tryReady, 30));
          tryReady();
        })
        .catch(reject);
    } catch (e) {
      reject(e);
    }
  });
  return katexLoading;
}

function renderSegments(text: string, katex: any): Array<React.ReactNode> {
  const nodes: Array<React.ReactNode> = [];
  if (!text) return [text];
  // First split display math $$...$$ and \\[ ... \\]
  const blockTokens = text.split(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g);
  for (const tok of blockTokens) {
    if (!tok) continue;
    if ((tok.startsWith('$$') && tok.endsWith('$$') && tok.length >= 4) || (tok.startsWith('\\[') && tok.endsWith('\\]') && tok.length >= 4)) {
      const expr = tok.slice(2, -2).trim();
      try {
        const html = katex.renderToString(expr, { displayMode: true, throwOnError: false, macros: KATEX_MACROS });
        nodes.push(<div key={nodes.length} dangerouslySetInnerHTML={{ __html: html }} />);
      } catch {
        nodes.push(<pre key={nodes.length} className="text-xs whitespace-pre-wrap">{expr}</pre>);
      }
    } else {
      // Split inline math $...$ and \\( ... \\)
      const inlineTokens = tok.split(/(\$(?:[^$]|\\\$)+?\$|\\\([\s\S]+?\\\))/g);
      for (const it of inlineTokens) {
        if (!it) continue;
        if ((it.startsWith('$') && it.endsWith('$') && it.length >= 2) || (it.startsWith('\\(') && it.endsWith('\\)') && it.length >= 4)) {
          const expr = it.startsWith('$') ? it.slice(1, -1).trim() : it.slice(2, -2).trim();
          try {
            const html = katex.renderToString(expr, { displayMode: false, throwOnError: false, macros: KATEX_MACROS });
            nodes.push(<span key={nodes.length} dangerouslySetInnerHTML={{ __html: html }} />);
          } catch {
            nodes.push(<code key={nodes.length}>{expr}</code>);
          }
        } else {
          nodes.push(<span key={nodes.length}>{it}</span>);
        }
      }
    }
  }
  return nodes.length ? nodes : [text];
}

export function MathText({ text }: { text: string }) {
  const [ready, setReady] = useState<boolean>(!!window.katex);
  useEffect(() => {
    if (!ready) {
      ensureKatex().then(() => setReady(true)).catch(() => setReady(false));
    }
  }, [ready]);

  const content = useMemo(() => {
    if (!text) return text;
    // Pre-normalize common JSON-escape pitfalls: "\text" becomes tab + "ext" if not double-escaped
    // Replace TAB + 'ext' -> '\text'
    const normalized = text.replace(/\t(?:ext)/g, '\\text');
    if (!window.katex) return normalized;
    return renderSegments(normalized, window.katex);
  }, [text, ready]);

  return <>{content}</>;
}
