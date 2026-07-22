import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KnowledgePipeline } from "./knowledge-pipeline";

describe("KnowledgePipeline", () => {
  it("renders without a client-only boundary", () => {
    const markup = renderToStaticMarkup(<KnowledgePipeline />);

    expect(markup).toContain("<figure");
    expect(markup).toContain("<ol");
    expect(markup).toContain("Codex Libre");
  });

  it("exposes the lifecycle label, description, and ordered stages", () => {
    render(<KnowledgePipeline />);

    const pipeline = screen.getByRole("figure", { name: "Knowledge lifecycle" });
    expect(pipeline).toHaveAccessibleDescription(
      "Community insight becomes reviewed, attributable knowledge without losing its source.",
    );

    const list = within(pipeline).getByRole("list", {
      name: "Conversation to Codex Libre stages",
    });
    const items = within(list).getAllByRole("listitem");

    expect(list.tagName).toBe("OL");
    expect(items).toHaveLength(4);

    ["Conversation", "Proposal", "Review", "Codex Libre"].forEach((stage, index) => {
      expect(within(items[index]).getByText(stage)).toBeVisible();
    });
  });

  it("identifies Codex Libre as the final destination without implying live progress", () => {
    render(<KnowledgePipeline />);

    const destination = screen.getByText("Codex Libre").closest("li");

    expect(destination).not.toHaveAttribute("aria-current");
    expect(within(destination as HTMLElement).getByText("Destination")).toBeVisible();
  });

  it("preserves one semantic flow and a vertical narrow-screen layout", () => {
    const { container } = render(<KnowledgePipeline />);

    const list = screen.getByRole("list", { name: "Conversation to Codex Libre stages" });
    expect(list).toHaveClass("grid-cols-1", "sm:grid-cols-4");

    within(list)
      .getAllByRole("listitem")
      .forEach((item) => {
        expect(item).toHaveClass("border-l", "sm:border-l-0", "sm:border-t");
      });

    expect(container.firstElementChild?.outerHTML).not.toMatch(/animate-|transition-/);
  });
});
