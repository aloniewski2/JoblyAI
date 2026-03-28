import { cn } from '../../lib/utils';

/**
 * Renders AI-generated markdown-like text cleanly.
 * Handles: ## headings, **bold**, *subdued*, - bullets, 1. numbered, blank-line paragraphs.
 */
export default function MarkdownText({ text, className }: { text: string; className?: string }) {
  if (!text?.trim()) return null;

  const blocks = text.trim().split(/\n{2,}/);

  return (
    <div className={cn('space-y-3 text-sm leading-relaxed', className)}>
      {blocks.map((block, bi) => <Block key={bi} raw={block} />)}
    </div>
  );
}

function Block({ raw }: { raw: string }) {
  const lines = raw.split('\n').map(l => l.trimEnd());
  if (!lines.length) return null;

  const first = lines[0].trim();

  // ── Section heading: ## Title or **Title** or **Title:**
  const headingMatch = first.match(/^(?:#{1,3}\s+|(\*\*[^*]+\*\*)[:\s]*$)/);
  if (headingMatch) {
    const text = first.replace(/^#{1,3}\s+/, '').replace(/\*\*/g, '').replace(/:?\s*$/, '');
    const rest = lines.slice(1).filter(Boolean);
    return (
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 pt-1">
          {text}
        </div>
        {rest.length > 0 && <Block raw={rest.join('\n')} />}
      </div>
    );
  }

  // ── List block: every non-empty line starts with - / • / * or digit.
  const isBullet = (l: string) => /^[-•*]\s+/.test(l.trim());
  const isNum    = (l: string) => /^\d+[.)]\s+/.test(l.trim());

  if (lines.every(l => !l.trim() || isBullet(l) || isNum(l))) {
    let counter = 0;
    return (
      <ul className="space-y-1.5">
        {lines.filter(l => l.trim()).map((line, li) => {
          const numbered = isNum(line.trim());
          if (numbered) counter++;
          const content = line.trim()
            .replace(/^[-•*]\s+/, '')
            .replace(/^\d+[.)]\s+/, '');

          // Check for STAR hint on same line (text in parens or starting with "Hint:" / italic)
          const [main, ...hint] = content.split(/\s*[–—]\s*(?=STAR|Hint:|Focus|Think)/);
          return (
            <li key={li} className="flex gap-2.5 items-start">
              <span className="flex-shrink-0 mt-0.5 w-5 text-right text-primary-500 dark:text-primary-400 font-semibold text-xs">
                {numbered ? `${counter}.` : '•'}
              </span>
              <span className="text-slate-700 dark:text-slate-300">
                <Inline text={main.trim()} />
                {hint.length > 0 && (
                  <span className="block text-xs text-slate-400 dark:text-slate-500 mt-0.5 italic">
                    {hint.join(' — ')}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  // ── Callout / STAR hint line (starts with > or "STAR hint:")
  if (first.startsWith('>') || /^(star hint|hint|note):/i.test(first)) {
    const content = raw.replace(/^>\s*/gm, '').replace(/^(star hint|hint|note):\s*/i, '');
    return (
      <div className="border-l-2 border-primary-300 dark:border-primary-700 pl-3 text-xs text-slate-500 dark:text-slate-400 italic">
        <Inline text={content} />
      </div>
    );
  }

  // ── Plain paragraph
  return (
    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
      {lines.map((line, li) => (
        <span key={li}>
          <Inline text={line} />
          {li < lines.length - 1 && '\n'}
        </span>
      ))}
    </p>
  );
}

function Inline({ text }: { text: string }) {
  // Split on **bold** and *subdued*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i} className="font-semibold text-slate-800 dark:text-slate-200">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*'))
          return <span key={i} className="text-slate-400 dark:text-slate-500 text-xs italic">{part.slice(1, -1)}</span>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
