import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CopyLinkButton } from "./copy-link-button";

beforeEach(() => {
  vi.stubGlobal("location", { ...window.location, origin: "https://mandaloria.example" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("CopyLinkButton", () => {
  it("copies the absolute url and shows a copied confirmation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    render(<CopyLinkButton path="/posts/123" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("https://mandaloria.example/posts/123"),
    );
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("resets back to the idle label after a couple of seconds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(<CopyLinkButton path="/posts/123" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    await vi.waitFor(() => expect(screen.getByText("Copied")).toBeInTheDocument());

    vi.advanceTimersByTime(2000);

    await vi.waitFor(() => expect(screen.getByText("Copy link")).toBeInTheDocument());
  });

  it("falls back without throwing when the clipboard API is refused, and reports the outcome", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    document.execCommand = vi.fn().mockReturnValue(true);

    render(<CopyLinkButton path="/posts/123" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByText("Copied")).toBeInTheDocument();
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("shows a failure state when neither the clipboard API nor the fallback succeed", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    document.execCommand = vi.fn().mockReturnValue(false);

    render(<CopyLinkButton path="/posts/123" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByText("Copy failed")).toBeInTheDocument();
  });
});
