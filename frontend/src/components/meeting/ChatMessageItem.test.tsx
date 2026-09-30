import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/types";
import { ChatMessageItem } from "./ChatMessageItem";

const message = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: "1",
  from: 2,
  from_name: "Bob",
  to: null,
  text: "hello",
  at: "2026-01-01T10:00:00.000Z",
  ...overrides,
});

function html(m: ChatMessage): string {
  return renderToStaticMarkup(<ChatMessageItem message={m} selfId={1} participants={[]} />);
}

describe("ChatMessageItem escaping", () => {
  it("shows a <script> tag as text", () => {
    const out = html(message({ text: "<script>alert(1)</script>" }));
    expect(out).not.toContain("<script");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("shows an <img onerror> tag as text", () => {
    const out = html(message({ text: '<img src=x onerror="alert(1)">' }));
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("escapes the sender name too, even though the server sets it", () => {
    const out = html(message({ from_name: '<img src=x onerror="alert(1)">' }));
    expect(out).not.toContain("<img src");
    expect(out).toContain("&lt;img");
  });

  it("does not turn links into anchors", () => {
    const out = html(message({ text: "see https://example.com/a?b=1&c=2 and javascript:alert(1)" }));
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("href");
    expect(out).toContain("https://example.com/a?b=1&amp;c=2");
  });

  it("does not build markup from a markdown link or an entity", () => {
    const out = html(message({ text: "[x](javascript:alert(1)) &lt;b&gt;" }));
    expect(out).not.toContain("<a ");
    expect(out).not.toContain("<b>");
    expect(out).toContain("&amp;lt;b&amp;gt;");
  });

  it("keeps line breaks with CSS, not with <br>", () => {
    const out = html(message({ text: "one\ntwo" }));
    expect(out).toContain("whitespace-pre-wrap");
    expect(out).toContain("one\ntwo");
  });

  it("labels a private message", () => {
    const out = html(message({ to: 1 }));
    expect(out).toContain('data-private="true"');
    expect(out).toContain("Me (private)");
    expect(html(message({}))).not.toContain("data-private");
  });
});
