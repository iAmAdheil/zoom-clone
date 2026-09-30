import { describe, expect, it } from "vitest";
import { safeNext, signInHref } from "./redirects";

describe("safeNext", () => {
  it("keeps a plain path, with query and hash", () => {
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/schedule")).toBe("/schedule");
    expect(safeNext("/j/8123456790?pwd=abc#x")).toBe("/j/8123456790?pwd=abc#x");
  });

  it("gives / for a missing or non-string value", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext(["/a", "/b"])).toBe("/");
    expect(safeNext("")).toBe("/");
  });

  it("blocks a tab, CR or LF between the slashes", () => {
    expect(safeNext("/\t/evil.example/")).toBe("/");
    expect(safeNext("/\r/evil.example/")).toBe("/");
    expect(safeNext("/\n/evil.example/")).toBe("/");
    expect(safeNext("\t//evil.example")).toBe("/");
    expect(safeNext("/ /evil.example")).toBe("/");
    expect(safeNext("/\u0000/evil.example")).toBe("/");
    expect(safeNext("/ /evil.example")).toBe("/");
  });

  it("blocks encoded slashes, control characters and backslashes", () => {
    expect(safeNext("/%09/evil.example/")).toBe("/");
    expect(safeNext("/%0a/evil.example/")).toBe("/");
    expect(safeNext("/%0d/evil.example/")).toBe("/");
    expect(safeNext("/%2F/evil.example")).toBe("/");
    expect(safeNext("/%5Cevil.example")).toBe("/");
    expect(safeNext("/%zz")).toBe("/");
  });

  it("blocks a backslash", () => {
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("\\\\evil.example")).toBe("/");
    expect(safeNext("/a\\b")).toBe("/");
  });

  it("blocks a double slash and a full URL", () => {
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("/redirect?to=https://evil.example")).toBe("/");
  });

  it("blocks javascript: and data: values", () => {
    expect(safeNext("javascript:alert(1)")).toBe("/");
    expect(safeNext("java\tscript:alert(1)")).toBe("/");
    expect(safeNext("data:text/html,x")).toBe("/");
  });
});

describe("signInHref", () => {
  it("encodes a safe path and drops an unsafe one", () => {
    expect(signInHref("/schedule")).toBe("/signin?next=%2Fschedule");
    expect(signInHref("//evil.example")).toBe("/signin?next=%2F");
  });
});
