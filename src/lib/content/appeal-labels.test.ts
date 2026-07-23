import { describe, expect, it } from "vitest";

import { appealActionLabel, parseAppealStatus } from "./appeal-labels";

describe("parseAppealStatus", () => {
  it("keeps a known status", () => {
    expect(parseAppealStatus("granted")).toBe("granted");
  });

  it("reads 'all' as no filter", () => {
    expect(parseAppealStatus("all")).toBeNull();
  });

  it("falls back to the open queue for anything else", () => {
    expect(parseAppealStatus(undefined)).toBe("open");
    expect(parseAppealStatus("nonsense")).toBe("open");
    expect(parseAppealStatus("")).toBe("open");
  });

  it("takes the first value when a parameter repeats", () => {
    expect(parseAppealStatus(["denied", "granted"])).toBe("denied");
  });
});

describe("appealActionLabel", () => {
  it("names the actions a member can argue with", () => {
    expect(appealActionLabel("user.banned")).toBe("Ban");
    expect(appealActionLabel("post.status")).toBe("Post removed or hidden");
  });

  it("shows an unknown action as itself rather than hiding it", () => {
    expect(appealActionLabel("something.new")).toBe("something.new");
  });
});
