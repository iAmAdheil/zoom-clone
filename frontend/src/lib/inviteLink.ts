// Reads a meeting ID or a pasted invite link. This file has no imports, so a plain Node test can load it.

export type JoinInput = {
  /** The digits of the meeting ID. Empty if there are none. */
  code: string;
  /** The `pwd` value of an invite link, or null. */
  passcode: string | null;
  /** True if the input is an invite link (it has `/j/<10 digits>`). */
  isLink: boolean;
};

const INVITE_PATH = /\/j\/(\d{10})(?!\d)/;

/** Reads the `pwd` query value of a pasted link. Returns null if there is none. */
function readPasscode(input: string): string | null {
  const query = input.split("#")[0].split("?")[1];
  if (query === undefined) return null;
  const value = new URLSearchParams(query).get("pwd");
  return value ? value : null;
}

/**
 * Splits the input into a meeting code and a passcode.
 * A full invite link ("http://host/j/1234567890?pwd=abc") gives both.
 * Anything else gives the digits of the input and no passcode.
 */
export function parseJoinInput(input: string): JoinInput {
  const text = input.trim();
  const fromLink = text.match(INVITE_PATH);
  if (fromLink) return { code: fromLink[1], passcode: readPasscode(text), isLink: true };
  return { code: text.replace(/\D/g, ""), passcode: null, isLink: false };
}

/** A query value from a page prop. It is a string, or "" if it is missing or repeated. */
export function queryText(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}
