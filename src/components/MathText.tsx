import React, { useEffect, useMemo, useState } from 'react';

declare global {
  interface Window {
    katex?: any;
  }
}

let katexLoading: Promise<any> | null = null;
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
      // Inject script
      const scriptId = 'katex-script';
      if (document.getElementById(scriptId)) {
        const tryReady = () => (window.katex ? resolve(window.katex) : setTimeout(tryReady, 30));
        tryReady();
      } else {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js';
        script.async = true;
        script.onload = () => resolve(window.katex);
        script.onerror = reject;
        document.head.appendChild(script);
      }
    } catch (e) {
      reject(e);
    }
  });
  return katexLoading;
}

function renderSegments(text: string, katex: any): Array<React.ReactNode> {
  const nodes: Array<React.ReactNode> = [];
  if (!text) return [text];
  // First split block math $$...$$
  const blockTokens = text.split(/(\$\$[\s\S]+?\$\$)/g);
  for (const tok of blockTokens) {
    if (!tok) continue;
    if (tok.startsWith('$$') && tok.endsWith('$$') && tok.length >= 4) {
      const expr = tok.slice(2, -2).trim();
      try {
        const html = katex.renderToString(expr, { displayMode: true, throwOnError: false });
        nodes.push(<div key={nodes.length} dangerouslySetInnerHTML={{ __html: html }} />);
      } catch {
        nodes.push(<pre key={nodes.length} className="text-xs whitespace-pre-wrap">{expr}</pre>);
      }
    } else {
      // Split inline math $...$
      const inlineTokens = tok.split(/(\$(?:[^$]|\\\$)+?\$)/g);
      for (const it of inlineTokens) {
        if (!it) continue;
        if (it.startsWith('$') && it.endsWith('$') && it.length >= 2) {
          const expr = it.slice(1, -1).trim();
          try {
            const html = katex.renderToString(expr, { displayMode: false, throwOnError: false });
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
    if (!window.katex) return text;
    return renderSegments(text, window.katex);
  }, [text, ready]);

  return <>{content}</>;
}
