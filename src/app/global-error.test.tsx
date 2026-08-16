import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import GlobalError from "./global-error";

describe("global error boundary", () => {
  it("renders a self-contained alert with retry and home actions", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();

    render(<GlobalError error={new Error("boom")} reset={reset} />);

    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("heading", { name: "This page could not be loaded" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Return to Mandaloria" })).toHaveAttribute("href", "/");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();

    consoleSpy.mockRestore();
  });

  it("logs only the digest, never the error message", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("secret internal detail") as Error & { digest?: string };
    error.digest = "ABCD1234";

    render(<GlobalError error={error} reset={() => {}} />);

    expect(consoleSpy).toHaveBeenCalledWith("Unhandled application error.", {
      digest: "ABCD1234",
    });
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("secret internal detail"));

    consoleSpy.mockRestore();
  });
});
