"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

interface MarkdownTextProps {
  content: string;
  /**
   * Wrapper class names. Use this to size / color the prose; child element
   * styles (p, ul, code, ...) inherit from `.markdown-prose` defined in
   * globals.css (aliased to `.navigator-prose`).
   */
  className?: string;
}

function renderHtml(content: string): string {
  const raw = marked.parse(content, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string;
  return DOMPurify.sanitize(raw);
}

/**
 * Render user-supplied markdown safely.
 *
 * - Uses `marked` for GFM (tables, task lists, strikethrough, ...).
 * - `DOMPurify` strips scripts / event handlers / javascript: URLs from the
 *   produced HTML before it touches the DOM.
 * - Client-only render: DOMPurify requires `window`. During SSR we render
 *   the raw text in pre-wrap so the description is still readable before
 *   hydration; once mounted, the markdown HTML replaces it.
 */
export default function MarkdownText({ content, className }: MarkdownTextProps) {
  const html = useMemo(() => {
    if (!content) return "";
    if (typeof window === "undefined") return "";
    return renderHtml(content);
  }, [content]);

  if (!content) return null;

  const wrapper = className ? className.trim() : "";

  if (!html) {
    return (
      <div className={`${wrapper} whitespace-pre-wrap break-words`.trim()}>{content}</div>
    );
  }

  return (
    <div
      className={`${wrapper} navigator-prose break-words`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
