import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AuditError from "./error";
import AuditLoading from "./loading";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Council audit route states", () => {
  it("renders a content-only loading state that models filters and audit rows", () => {
    const { container } = render(<AuditLoading />);

    expect(screen.getByLabelText("Loading audit log")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(40);
  });

  it("focuses the retry action and resets the local route boundary", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reset = vi.fn();

    render(<AuditError error={new Error("request failed")} reset={reset} />);

    const alert = screen.getByRole("alert");
    const retry = screen.getByRole("button", { name: "Retry" });

    expect(alert).toHaveAccessibleName("Audit log unavailable");
    expect(alert).toHaveAccessibleDescription("We could not load the audit log. Try again.");
    expect(retry).toHaveFocus();
    expect(retry).toHaveClass("h-11");

    fireEvent.click(retry);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("does not render or log sensitive error details", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("secret service-role credential"), {
      digest: "public-digest",
    });

    render(<AuditError error={error} reset={vi.fn()} />);

    expect(screen.queryByText(/secret service-role credential/i)).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith("Council audit log failed to load.", {
      digest: "public-digest",
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret service-role credential");
  });
});
