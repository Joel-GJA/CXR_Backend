import React, { useRef, useEffect } from 'react';

export default function LogTerminal({ lines = [], height = 'md', autoScroll = true, label = 'terminal' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (autoScroll && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  function lineClass(text) {
    const t = text.toLowerCase();
    if (t.includes('error') || t.includes('err ') || t.includes('exception')) return 'log-line-error';
    if (t.includes('warn'))  return 'log-line-warn';
    if (t.includes('debug')) return 'log-line-debug';
    return 'log-line-info';
  }

  return (
    <div className="terminal-wrap">
      <div className="terminal-chrome">
        <span className="tc-dot red" />
        <span className="tc-dot yellow" />
        <span className="tc-dot green" />
        <span className="tc-label">{label}</span>
      </div>
      <div ref={ref} className={`terminal terminal-${height}`}>
        {lines.length === 0
          ? <span className="muted">No output yet...</span>
          : lines.map((line, i) => (
              <div key={i} className={lineClass(line)}>{line}</div>
            ))
        }
      </div>
    </div>
  );
}
