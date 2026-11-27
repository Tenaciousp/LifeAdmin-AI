const LINK_PATTERN = /\[([^\]]{1,200})\]\((https:\/\/[^)\s]+)\)|(https:\/\/[^\s<>"']+)/gi;

function safeUrl(value: string) {
  try {
    const url = new URL(value.replace(/[),.;!?\]}]+$/, ""));
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function sourceLinks(text: string) {
  const found: string[] = [];
  for (const match of text.matchAll(LINK_PATTERN)) {
    const url = safeUrl(match[2] || match[3] || "");
    if (url) found.push(url);
  }
  return [...new Set(found)];
}

export default function LinkifiedText({ text, className = "" }: { text: string; className?: string }) {
  const content: React.ReactNode[] = [];
  let offset = 0;
  let match: RegExpExecArray | null;
  LINK_PATTERN.lastIndex = 0;
  while ((match = LINK_PATTERN.exec(text))) {
    if (match.index > offset) content.push(text.slice(offset, match.index));
    const rawUrl = match[2] || match[3] || "";
    const href = safeUrl(rawUrl);
    const trailing = match[2] ? "" : rawUrl.slice((href || "").length);
    if (href) content.push(<ExternalLink key={`link-${match.index}`} className="break-all font-semibold text-violet-800 underline underline-offset-2" href={href}>{match[1] || href}</ExternalLink>);
    else content.push(match[0]);
    if (trailing) content.push(trailing);
    offset = match.index + match[0].length;
  }
  if (offset < text.length) content.push(text.slice(offset));
  return <span className={className}>{content.map((part, index) => typeof part === "string" ? <span key={`text-${index}`}>{part}</span> : part)}</span>;
}
import ExternalLink from "./ExternalLink";

