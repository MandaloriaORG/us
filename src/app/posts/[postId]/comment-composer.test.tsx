import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CommentComposer } from "./comment-composer";

describe("CommentComposer", () => {
  it("disables submit until there is text, and clears the field after a successful create", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, commentId: "1" });
    const onSuccess = vi.fn();
    render(
      <CommentComposer
        id="c"
        label="Add a comment"
        submitLabel="Post comment"
        onSubmit={onSubmit}
        onSuccess={onSuccess}
      />,
    );

    const submit = screen.getByRole("button", { name: "Post comment" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Add a comment"), { target: { value: "Hello" } });
    expect(submit).toBeEnabled();

    fireEvent.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Hello"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(screen.getByLabelText("Add a comment")).toHaveValue("");
  });

  it("keeps the edited text on screen and shows the field error when the save is refused", async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      ok: false,
      code: "invalid_input",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { body: "Comment cannot be empty" },
    });
    render(
      <CommentComposer
        id="edit"
        label="Edit comment"
        submitLabel="Save"
        initialValue="Original"
        onSubmit={onSubmit}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Edit comment"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Comment cannot be empty")).toBeInTheDocument();
    expect(screen.getByLabelText("Edit comment")).toHaveValue("Changed");
  });

  it("calls onCancel when provided, and hides the cancel button otherwise", () => {
    const onCancel = vi.fn();
    render(
      <CommentComposer
        id="reply"
        label="Reply"
        submitLabel="Post reply"
        onSubmit={vi.fn()}
        onSuccess={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("omits the cancel button when no onCancel is given", () => {
    render(
      <CommentComposer
        id="top"
        label="Add"
        submitLabel="Post"
        onSubmit={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
});
