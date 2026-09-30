// Run with: npm test (Node built-in test runner, TypeScript type stripping).
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { parseJoinInput, queryText } from "../src/lib/inviteLink.ts";
import { passcodes } from "../src/lib/storage.ts";

test("a full invite link gives the code and the passcode", () => {
  assert.deepEqual(parseJoinInput("http://host/j/1234567890?pwd=abc"), {
    code: "1234567890",
    passcode: "abc",
    isLink: true,
  });
});

test("the passcode is URL-decoded, and a plus sign stays a plus sign", () => {
  const link = `https://x.app/j/1234567890?pwd=${encodeURIComponent("a b+c&d")}`;
  assert.equal(parseJoinInput(link).passcode, "a b+c&d");
});

test("a link with no pwd, an empty pwd, or a hash gives no passcode", () => {
  assert.equal(parseJoinInput("http://host/j/1234567890").passcode, null);
  assert.equal(parseJoinInput("http://host/j/1234567890?pwd=").passcode, null);
  assert.equal(parseJoinInput("http://host/j/1234567890#pwd=x").passcode, null);
  assert.equal(parseJoinInput("http://host/j/1234567890?a=1&pwd=z#top").passcode, "z");
});

test("a link with spaces around it and no scheme still works", () => {
  const parsed = parseJoinInput("  host.com/j/1234567890?pwd=q  ");
  assert.equal(parsed.code, "1234567890");
  assert.equal(parsed.passcode, "q");
});

test("a plain ID keeps only digits and has no passcode", () => {
  assert.deepEqual(parseJoinInput("123 4567 890"), { code: "1234567890", passcode: null, isLink: false });
  assert.deepEqual(parseJoinInput(""), { code: "", passcode: null, isLink: false });
});

test("a code with more than 10 digits in a link is not a link", () => {
  assert.equal(parseJoinInput("http://host/j/12345678901?pwd=a").isLink, false);
});

test("queryText accepts only one string", () => {
  assert.equal(queryText("abc"), "abc");
  assert.equal(queryText(["a", "b"]), "");
  assert.equal(queryText(undefined), "");
});

beforeEach(() => {
  const data = new Map();
  globalThis.window = {
    sessionStorage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
  };
});

test("the passcode is stored per meeting code and can be cleared", () => {
  assert.equal(passcodes.read("1234567890"), null);
  passcodes.write("1234567890", "abc");
  assert.equal(passcodes.read("1234567890"), "abc");
  assert.equal(passcodes.read("9999999999"), null);
  passcodes.write("1234567890", null);
  assert.equal(passcodes.read("1234567890"), null);
});

test("storage that throws does not break the passcode helpers", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    get() {
      throw new Error("blocked");
    },
  });
  assert.equal(passcodes.read("1234567890"), null);
  passcodes.write("1234567890", "abc");
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: undefined });
});
