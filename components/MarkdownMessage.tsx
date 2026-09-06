import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// AI replies sometimes come back with markdown (bold, numbered/bulleted
// lists) even though nothing asked for it — Gemini's natural style for a
// "여기 3가지가 있어요" answer. Rendering that raw (as the plain
// whitespace-pre-wrap paragraph the user's own messages use) shows literal
// "**" and "1." characters instead of an actual list. Only assistant
// messages go through this; the user's own typed text is shown as-is.
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink/40">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 marker:font-medium marker:text-ink/60">
              {children}
            </ol>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[13px]">
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
