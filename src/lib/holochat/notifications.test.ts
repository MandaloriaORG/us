import { describe, expect, it } from "vitest";

import {
  defaultNotificationPreferences,
  NOTIFICATION_TYPES,
  notificationHref,
  notificationSummary,
} from "@/lib/holochat/notifications";

describe("notification vocabulary", () => {
  it("covers exactly the database notification types", () => {
    expect(NOTIFICATION_TYPES).toEqual([
      "post_reply",
      "comment_reply",
      "reaction",
      "mention",
      "friend_request",
      "clan_invite",
      "warning",
      "announcement",
      "report_resolved",
    ]);
  });

  it("defaults every type to enabled", () => {
    const prefs = defaultNotificationPreferences();
    expect(Object.keys(prefs)).toHaveLength(NOTIFICATION_TYPES.length);
    for (const type of NOTIFICATION_TYPES) {
      expect(prefs[type]).toBe(true);
    }
  });
});

describe("notificationHref", () => {
  it("links reply notifications to the post in the payload", () => {
    expect(notificationHref("post_reply", { post_id: "p" })).toBe("/posts/p");
    expect(notificationHref("comment_reply", { post_id: "p" })).toBe("/posts/p");
  });

  it("links reaction notifications to the post when present, else the comment", () => {
    expect(notificationHref("reaction", { post_id: "p" })).toBe("/posts/p");
    expect(notificationHref("reaction", { comment_id: "c" })).toBe("/posts/c");
  });

  it("links clan invitations through the clan slug when known", () => {
    expect(notificationHref("clan_invite", { clan_slug: "the-clan" })).toBe("/clans/the-clan");
  });

  it("degrades to a safe destination when the payload has no id", () => {
    expect(notificationHref("post_reply", {})).toBe("/posts");
    expect(notificationHref("friend_request", {})).toBe("/members");
    expect(notificationHref("announcement", {})).toBe("/holochat");
  });
});

describe("notificationSummary", () => {
  it("names the actor for actor-bearing types", () => {
    expect(notificationSummary("post_reply", "Ada", {})).toBe("Ada replied to your post");
    expect(notificationSummary("comment_reply", "Ada", {})).toBe("Ada replied to your comment");
    expect(notificationSummary("friend_request", "Ada", {})).toBe("Ada sent you a friend request");
    expect(notificationSummary("clan_invite", "Ada", {})).toBe("Ada invited you to a clan");
  });

  it("distinguishes post and comment reactions", () => {
    expect(notificationSummary("reaction", "Ada", { comment_id: "c" })).toBe(
      "Ada reacted to your comment",
    );
    expect(notificationSummary("reaction", "Ada", {})).toBe("Ada reacted to your post");
  });

  it("does not pretend an actor exists when the profile is gone", () => {
    expect(notificationSummary("post_reply", null, {})).toBe("Someone replied to your post");
  });

  it("keeps warnings and announcements impersonal", () => {
    expect(notificationSummary("warning", "Ada", {})).toBe("You received a warning");
    expect(notificationSummary("announcement", "Ada", {})).toBe(
      "The Council posted an announcement",
    );
  });
});
