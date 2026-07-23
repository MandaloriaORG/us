import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPost: vi.fn(),
  updatePost: vi.fn(),
  setPostTags: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
}));

vi.mock("@/lib/actions/content", () => ({
  createPost: mocks.createPost,
  updatePost: mocks.updatePost,
  setPostTags: mocks.setPostTags,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back }),
}));

import { PostForm } from "./post-form";

const plazaId = "10000000-0000-4000-8000-000000000001";
const postId = "20000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setPostTags.mockResolvedValue({ ok: true, tagSlugs: [] });
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
        initialTagSlugs={[]}
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

  it("submits parsed tags with the new post and navigates once both calls succeed", async () => {
    mocks.createPost.mockResolvedValue({ ok: true, postId });
    render(<PostForm mode="create" plazaId={plazaId} />);

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "My title" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "My body" } });
    fireEvent.change(screen.getByLabelText(/Tags/), {
      target: { value: "Lore, west-marsh  lore," },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));

    await waitFor(() =>
      expect(mocks.setPostTags).toHaveBeenCalledWith({
        postId,
        tagSlugs: ["lore", "west-marsh"],
      }),
    );
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/posts/${postId}`));
  });

  it("still navigates when the post is created but setting its tags fails", async () => {
    mocks.createPost.mockResolvedValue({ ok: true, postId });
    mocks.setPostTags.mockResolvedValue({
      ok: false,
      code: "invalid_input",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { tagSlugs: "Use lowercase words separated by hyphens" },
    });
    render(<PostForm mode="create" plazaId={plazaId} />);

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "My title" } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "My body" } });
    fireEvent.change(screen.getByLabelText(/Tags/), { target: { value: "not a slug!" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish post" }));

    await waitFor(() => expect(mocks.setPostTags).toHaveBeenCalled());
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/posts/${postId}`));
  });

  it("edit mode pre-fills tags and saves both post and tags before navigating", async () => {
    mocks.updatePost.mockResolvedValue({ ok: true, postId });
    render(
      <PostForm
        mode="edit"
        postId={postId}
        initialTitle="Existing title"
        initialBody="Existing body"
        initialTagSlugs={["lore", "west-marsh"]}
      />,
    );

    expect(screen.getByLabelText(/Tags/)).toHaveValue("lore, west-marsh");

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mocks.setPostTags).toHaveBeenCalledWith({
        postId,
        tagSlugs: ["lore", "west-marsh"],
      }),
    );
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/posts/${postId}`));
  });

  it("edit mode surfaces a tag validation error beside the field and does not navigate", async () => {
    mocks.updatePost.mockResolvedValue({ ok: true, postId });
    mocks.setPostTags.mockResolvedValue({
      ok: false,
      code: "invalid_input",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { tagSlugs: "Use lowercase words separated by hyphens" },
    });
    render(
      <PostForm
        mode="edit"
        postId={postId}
        initialTitle="Existing title"
        initialBody="Existing body"
        initialTagSlugs={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Tags/), { target: { value: "not a slug!" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Use lowercase words separated by hyphens")).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
