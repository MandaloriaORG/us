import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setPlazaStatus: vi.fn() }));

vi.mock("@/lib/actions/plazas", () => ({ setPlazaStatus: mocks.setPlazaStatus }));

import { PlazaStatusControl } from "./plaza-status-control";

const plazaId = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  mocks.setPlazaStatus.mockReset();
});

describe("PlazaStatusControl", () => {
  it("requires a reason of at least 3 characters before archiving", () => {
    render(<PlazaStatusControl plazaId={plazaId} status="active" />);

    fireEvent.click(screen.getByRole("button", { name: "Archive Plaza" }));

    expect(
      screen.getByText("Give a reason of at least 3 characters."),
    ).toBeInTheDocument();
    expect(mocks.setPlazaStatus).not.toHaveBeenCalled();
  });

  it("archives an active Plaza as compare-and-swap against its current status", async () => {
    mocks.setPlazaStatus.mockResolvedValue({ ok: true, plazaId });
    render(<PlazaStatusControl plazaId={plazaId} status="active" />);

    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: "Superseded by the Codex." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Archive Plaza" }));

    await waitFor(() =>
      expect(mocks.setPlazaStatus).toHaveBeenCalledWith({
        plazaId,
        expectedStatus: "active",
        status: "archived",
        reason: "Superseded by the Codex.",
      }),
    );
    expect(await screen.findByText("Plaza archived.")).toBeInTheDocument();
  });

  it("offers reactivation for an archived Plaza", async () => {
    mocks.setPlazaStatus.mockResolvedValue({ ok: true, plazaId });
    render(<PlazaStatusControl plazaId={plazaId} status="archived" />);

    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: "Reopening for a new season." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reactivate Plaza" }));

    await waitFor(() =>
      expect(mocks.setPlazaStatus).toHaveBeenCalledWith({
        plazaId,
        expectedStatus: "archived",
        status: "active",
        reason: "Reopening for a new season.",
      }),
    );
    expect(await screen.findByText("Plaza reactivated.")).toBeInTheDocument();
  });

  it("shows the conflict message and tells the caller to reload", async () => {
    mocks.setPlazaStatus.mockResolvedValue({
      ok: false,
      code: "conflict",
      message: "This Plaza changed while you were viewing it. Reload and try again.",
    });
    render(<PlazaStatusControl plazaId={plazaId} status="active" />);

    fireEvent.change(screen.getByLabelText(/Reason/), {
      target: { value: "Superseded by the Codex." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Archive Plaza" }));

    expect(
      await screen.findByText("This Plaza changed while you were viewing it. Reload and try again."),
    ).toBeInTheDocument();
  });
});
