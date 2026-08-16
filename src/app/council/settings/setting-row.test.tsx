import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateSiteSetting: vi.fn(),
}));

vi.mock("@/lib/actions/settings", () => ({
  updateSiteSetting: mocks.updateSiteSetting,
}));

// Radix Checkbox sizes itself via ResizeObserver, which jsdom does not provide.
class ResizeObserverStub {
  disconnect() {}
  observe() {}
  unobserve() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

import { SettingRow } from "./setting-row";

beforeEach(() => {
  vi.clearAllMocks();
});

const stringSetting = {
  description: "The community's name.",
  label: "Site name",
  maxValue: null,
  minValue: null,
  settingKey: "site.name",
  valueType: "string" as const,
};

describe("SettingRow", () => {
  it("sends the edited value with the shown value as the compare-and-swap guard", async () => {
    mocks.updateSiteSetting.mockResolvedValue({ ok: true, key: "site.name" });

    render(<SettingRow {...stringSetting} value="Mandaloria" />);

    fireEvent.change(screen.getByLabelText("Site name"), {
      target: { value: "New Mandaloria" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Saved.");

    expect(mocks.updateSiteSetting).toHaveBeenCalledWith({
      key: "site.name",
      valueType: "string",
      value: "New Mandaloria",
      expectedValue: "Mandaloria",
    });
  });

  it("moves the committed value forward so a second save does not conflict", async () => {
    mocks.updateSiteSetting.mockResolvedValue({ ok: true, key: "site.name" });

    render(<SettingRow {...stringSetting} value="Mandaloria" />);

    fireEvent.change(screen.getByLabelText("Site name"), {
      target: { value: "Round Two" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved.");

    fireEvent.change(screen.getByLabelText("Site name"), {
      target: { value: "Round Three" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved.");

    const calls = mocks.updateSiteSetting.mock.calls;
    expect(calls[1][0].expectedValue).toBe("Round Two");
  });

  it("surfaces a compare-and-swap conflict without claiming success", async () => {
    mocks.updateSiteSetting.mockResolvedValue({
      ok: false,
      code: "conflict",
      message: "This setting changed while you were viewing it. Reload and try again.",
    });

    render(<SettingRow {...stringSetting} value="Mandaloria" />);

    fireEvent.change(screen.getByLabelText("Site name"), {
      target: { value: "Stale Edit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/changed while you were viewing it/)).toBeVisible();
    expect(screen.queryByText("Saved.")).toBeNull();
  });

  it("toggles a boolean setting and saves the new state", async () => {
    mocks.updateSiteSetting.mockResolvedValue({ ok: true, key: "site.registration_open" });

    render(
      <SettingRow
        description="Whether new accounts can register."
        label="Open registration"
        maxValue={null}
        minValue={null}
        settingKey="site.registration_open"
        value={true}
        valueType="boolean"
      />,
    );

    fireEvent.click(screen.getByLabelText("Open registration"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Saved.");

    expect(mocks.updateSiteSetting).toHaveBeenCalledWith({
      key: "site.registration_open",
      valueType: "boolean",
      value: false,
      expectedValue: true,
    });
  });

  it("rejects invalid JSON locally without reaching the action", async () => {
    render(
      <SettingRow
        description="Canonical navigation items."
        label="Navigation"
        maxValue={null}
        minValue={null}
        settingKey="site.navigation"
        value={[]}
        valueType="array"
      />,
    );

    fireEvent.change(screen.getByLabelText("Navigation"), { target: { value: "{ not json" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Enter valid JSON.")).toBeVisible();
    expect(mocks.updateSiteSetting).not.toHaveBeenCalled();
  });

  it("round-trips a valid JSON object to the action", async () => {
    mocks.updateSiteSetting.mockResolvedValue({ ok: true, key: "features.reactions" });

    render(
      <SettingRow
        description="Feature flags for reaction behaviour."
        label="Reactions"
        maxValue={null}
        minValue={null}
        settingKey="features.reactions"
        value={{}}
        valueType="json"
      />,
    );

    fireEvent.change(screen.getByLabelText("Reactions"), {
      target: { value: '{ "enabled": true }' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Saved.");

    expect(mocks.updateSiteSetting).toHaveBeenCalledWith({
      key: "features.reactions",
      valueType: "json",
      value: { enabled: true },
      expectedValue: {},
    });
  });
});
