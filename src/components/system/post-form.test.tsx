import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPost: vi.fn(),
  updatePost: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
}));

vi.mock("@/lib/actions/content", () => ({
  createPost: mocks.createPost,
  updatePost: mocks.updatePost,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back }),
}));

import { PostForm } from "./post-form";

const plazaId = "10000000-0000-4000-8000-000000000001";
const postId = "20000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PostForm", () => {
  it("submits a new post and navigates to it once the server confirms", async () => {
    mocks.createPost.mockResolvedValue({ ok: true, postId });
    render(<PostForm mode="create" plazaId={plazaId} />);

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "My title" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "My body" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));

    await waitFor(() =>
      expect(mocks.createPost).toHaveBeenCalledWith({
        plazaId,
        title: "My title",
        body: "My body",
      }),
    );
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/posts/${postId}`));
  });

  it("shows field errors beside the field and does not navigate", async () => {
    mocks.createPost.mockResolvedValue({
      ok: false,
      code: "invalid_input",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { title: "Title must be at least 3 characters" },
    });
    render(<PostForm mode="create" plazaId={plazaId} />);

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "ab" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "body" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));

    expect(await screen.findByText("Title must be at least 3 characters")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("edit mode pre-fills the fields and calls updatePost with the existing id", async () => {
    mocks.updatePost.mockResolvedValue({ ok: true, postId });
    render(
      <PostForm
        mode="edit"
        postId={postId}
        initialTitle="Existing title"
        initialBody="Existing body"
      />,
    );

    expect(screen.getByLabelText(/Title/)).toHaveValue("Existing title");
    expect(screen.getByLabelText("Body")).toHaveValue("Existing body");

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mocks.updatePost).toHaveBeenCalledWith({
        postId,
        title: "Existing title",
        body: "Existing body",
      }),
    );
  });

  it("cancel goes back without confirmation when nothing was typed", () => {
    render(<PostForm mode="create" plazaId={plazaId} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.back).toHaveBeenCalled();
  });
});
