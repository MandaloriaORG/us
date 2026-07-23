import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ deletePost: vi.fn(), push: vi.fn() }));

vi.mock("@/lib/actions/content", () => ({ deletePost: mocks.deletePost }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

import { PostOwnerActions } from "./post-owner-actions";

const postId = "20000000-0000-4000-8000-000000000001";

beforeEach(() => vi.clearAllMocks());

describe("PostOwnerActions", () => {
  it("links to the edit page", () => {
    render(<PostOwnerActions postId={postId} plazaSlug="general" />);
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      `/posts/${postId}/edit`,
    );
  });

  it("requires an explicit confirm before calling deletePost", async () => {
    mocks.deletePost.mockResolvedValue({ ok: true, postId });
    render(<PostOwnerActions postId={postId} plazaSlug="general" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(mocks.deletePost).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(mocks.deletePost).toHaveBeenCalledWith(postId));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/plazas/general"));
  });

  it("shows the server message and does not navigate when the delete is refused", async () => {
    mocks.deletePost.mockResolvedValue({
      ok: false,
      code: "access_denied",
      message: "Not your post.",
    });
    render(<PostOwnerActions postId={postId} plazaSlug="general" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(await screen.findByText("Not your post.")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
