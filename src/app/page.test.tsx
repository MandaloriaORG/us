import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("public landing page", () => {
  it("has one identity headline and two clear public actions", () => {
    render(<HomePage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Conversation that becomes shared knowledge.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Explore Plazas/ })).toHaveAttribute("href", "/plazas");
    expect(screen.getByRole("link", { name: "Read Codex Libre" })).toHaveAttribute(
      "href",
      "/codex",
    );
  });

  it("uses the custom knowledge lifecycle as the hero proof", () => {
    render(<HomePage />);

    const pipeline = screen.getByRole("figure", { name: "Knowledge lifecycle" });
    const stages = within(pipeline).getAllByRole("listitem");

    expect(
      stages.map(
        (stage) => within(stage).getByText(/Conversation|Proposal|Review|Codex Libre/).textContent,
      ),
    ).toEqual(["Conversation", "Proposal", "Review", "Codex Libre"]);
    expect(stages[3]).not.toHaveAttribute("aria-current");
    expect(within(stages[3]).getByText("Destination")).toBeVisible();
  });

  it("links the four canonical participation areas without card-only navigation", () => {
    const { container } = render(<HomePage />);

    expect(
      screen.getByRole("heading", { level: 2, name: "One network, four ways to participate" }),
    ).toBeInTheDocument();

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/plazas", "/codex", "/holochat", "/clans"]));
    expect(container.querySelectorAll("section ul > li")).toHaveLength(4);
  });
});
