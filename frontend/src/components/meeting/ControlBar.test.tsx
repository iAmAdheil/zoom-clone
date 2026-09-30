import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { passcodeText } from "@/lib/format";
import { ControlBar } from "./ControlBar";

function bar(overrides: Partial<Parameters<typeof ControlBar>[0]> = {}): string {
  const noop = () => {};
  return renderToStaticMarkup(
    <ControlBar
      micOn
      camOn
      micAvailable
      camAvailable
      audioMenu={{ groups: [], actions: [] }}
      videoMenu={{ groups: [], actions: [] }}
      showDeviceMenus={false}
      panel={null}
      participantCount={3}
      panelOpen={false}
      unreadChat={0}
      isHost={false}
      onToggleMic={noop}
      onToggleCam={noop}
      onTogglePanel={noop}
      onReact={noop}
      onShare={noop}
      onCopyInvite={noop}
      onLeave={noop}
      onEndForAll={noop}
      {...overrides}
    />,
  );
}

describe("ControlBar accessible names (BUG-22)", () => {
  it("starts the Participants name with the word, then the count", () => {
    expect(bar()).toContain('aria-label="Participants, 3"');
    expect(bar({ participantCount: 12 })).toContain('aria-label="Participants, 12"');
  });

  it("hides the count badge from screen readers", () => {
    expect(bar()).toMatch(/aria-hidden="true"[^>]*>3<\/span>/);
  });

  it("gives the Chat button a badge and a name with the unread count", () => {
    const out = bar({ unreadChat: 4 });
    expect(out).toContain('aria-label="Chat, 4 unread"');
    expect(out).toMatch(/aria-hidden="true"[^>]*>4<\/span>/);
  });

  it("has no unread text when nothing is unread", () => {
    const out = bar();
    expect(out).toContain('aria-label="Chat"');
    expect(out).not.toContain("unread");
  });
});

describe("ControlBar tap targets on phones (BUG-13)", () => {
  it("makes End, Leave and Cancel at least 40 px high", () => {
    expect(bar({ isHost: false })).toMatch(/class="h-10 [^"]*sm:h-9[^"]*"[^>]*>Leave<\/button>/);
    expect(bar({ isHost: true })).toMatch(/class="h-10 [^"]*sm:h-9[^"]*"[^>]*>End<\/button>/);
  });
});

describe("passcodeText", () => {
  it("shows the value to the host, who gets it from the API", () => {
    expect(passcodeText({ passcode: "abc123", requires_passcode: true })).toBe("abc123");
  });

  it("shows only 'Required' to a guest (the API sends null and requires_passcode)", () => {
    expect(passcodeText({ passcode: null, requires_passcode: true })).toBe("Required");
  });

  it("shows 'None' when there is no passcode", () => {
    expect(passcodeText({ passcode: null, requires_passcode: false })).toBe("None");
  });
});
