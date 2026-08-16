import { describe, expect, it } from "vitest";
import {
  ARTICLE_STATUS_LABELS,
  isOpenProposalStatus,
  PROPOSAL_STATUS_LABELS,
  PUBLIC_ARTICLE_STATUSES,
} from "@/lib/codex/states";

describe("codex states", () => {
  it("labels every article status", () => {
    expect(Object.keys(ARTICLE_STATUS_LABELS).sort()).toEqual([
      "archived",
      "draft",
      "locked",
      "published",
      "unpublished",
    ]);
  });

  it("treats published and locked as the public statuses", () => {
    expect(PUBLIC_ARTICLE_STATUSES).toEqual(["published", "locked"]);
  });

  it("labels every proposal status", () => {
    expect(Object.keys(PROPOSAL_STATUS_LABELS).sort()).toEqual([
      "classified",
      "drafting",
      "proposed",
      "published",
      "rejected",
      "reopened",
      "replaced",
      "reviewed",
      "withdrawn",
    ]);
  });

  it.each(["proposed", "classified", "drafting", "reviewed", "reopened"])(
    "keeps %s open to edits and withdrawal",
    (status) => {
      expect(isOpenProposalStatus(status as never)).toBe(true);
    },
  );

  it.each(["published", "rejected", "withdrawn", "replaced"])(
    "closes %s to edits and withdrawal",
    (status) => {
      expect(isOpenProposalStatus(status as never)).toBe(false);
    },
  );
});
