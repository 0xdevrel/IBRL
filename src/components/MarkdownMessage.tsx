'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownMessage({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <div className="mt-3 font-sans text-[14px] font-semibold tracking-tight text-[var(--color-forest)]">
            {children}
          </div>
        ),
        h2: ({ children }) => (
          <div className="mt-3 font-sans text-[13px] font-semibold tracking-tight text-[var(--color-forest)]">
            {children}
          </div>
        ),
        h3: ({ children }) => (
          <div className="mt-3 font-sans text-[12px] font-semibold tracking-tight text-[var(--color-forest)]">
            {children}
          </div>
        ),
        p: ({ children }) => <div className="mt-2 whitespace-pre-wrap">{children}</div>,
        ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
        li: ({ children }) => <li className="whitespace-pre-wrap">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-[rgba(58,58,56,0.92)]">{children}</strong>,
        em: ({ children }) => <em className="text-[rgba(58,58,56,0.86)]">{children}</em>,
        hr: () => <div className="my-3 h-px w-full bg-[rgba(58,58,56,0.2)]" />,
        code: ({ children }) => (
          <code className="rounded-[2px] border border-[rgba(58,58,56,0.2)] bg-[var(--color-paper)] px-1 py-[1px] font-mono text-[11px]">
            {children}
          </code>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

