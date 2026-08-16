import { describe, expect, it } from "vitest";
import { isSafeExternalUrl } from "@/lib/codex/url";

describe("isSafeExternalUrl", () => {
  it("accepts http and https links", () => {
    expect(isSafeExternalUrl("https://example.org/founding")).toBe(true);
    expect(isSafeExternalUrl("http://example.org")).toBe(true);
  });

  it("rejects javascript:, data:, credentials and control characters", () => {
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("data:text/html,<script>1</script>")).toBe(false);
    expect(isSafeExternalUrl("https://user:pass@example.org")).toBe(false);
    expect(isSafeExternalUrl("https://example.org/\u0000")).toBe(false);
    expect(isSafeExternalUrl("java\nscript:alert(1)")).toBe(false);
  });

  it("rejects relative and empty links", () => {
    expect(isSafeExternalUrl("")).toBe(false);
    expect(isSafeExternalUrl("/codex/the-way")).toBe(false);
  });
});
