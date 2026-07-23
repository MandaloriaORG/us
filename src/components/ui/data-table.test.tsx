import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable, type DataTableColumn } from "./data-table";

interface MemberRow {
  id: string;
  name: string;
  status: string;
}

const rows: MemberRow[] = [
  { id: "din", name: "Din Djarin", status: "Active" },
  { id: "bo", name: "Bo-Katan Kryze", status: "Suspended" },
];

const columns: DataTableColumn<MemberRow>[] = [
  {
    id: "name",
    header: () => "Member",
    cell: (row) => row.name,
  },
  {
    id: "status",
    header: () => "Status",
    cell: (row) => row.status,
  },
];

describe("DataTable", () => {
  it("renders a labelled scroll region and semantic table content", () => {
    const rowKey = vi.fn((row: MemberRow) => row.id);

    render(
      <DataTable
        ariaLabel="Council members table"
        caption="Council members and account status"
        columns={columns}
        rowKey={rowKey}
        rows={rows}
      />,
    );

    const region = screen.getByRole("region", { name: "Council members table" });
    const table = within(region).getByRole("table", {
      name: "Council members and account status",
    });

    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("overflow-x-auto");
    expect(within(table).getByText("Council members and account status").tagName).toBe("CAPTION");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(2);
    expect(within(table).getByRole("columnheader", { name: "Member" })).toHaveAttribute(
      "scope",
      "col",
    );
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getAllByRole("cell")).toHaveLength(4);
    expect(within(table).getByText("Din Djarin")).toBeVisible();
    expect(within(table).getByText("Suspended")).toBeVisible();
    expect(rowKey).toHaveBeenCalledTimes(2);
  });

  it("renders the configured empty state in a spanning body cell", () => {
    render(
      <DataTable
        ariaLabel="Filtered members table"
        caption="Filtered Council members"
        columns={columns}
        emptyState={<p>No members match these filters.</p>}
        rowKey={(row) => row.id}
        rows={[]}
      />,
    );

    const table = screen.getByRole("table", { name: "Filtered Council members" });
    const bodyCell = within(table).getByRole("cell");

    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(bodyCell).toHaveAttribute("colspan", "2");
    expect(bodyCell).toHaveTextContent("No members match these filters.");
  });

  it("uses compact cell spacing only when dense is requested", () => {
    const { rerender } = render(
      <DataTable
        ariaLabel="Members table"
        caption="Members"
        columns={columns}
        rowKey={(row) => row.id}
        rows={rows.slice(0, 1)}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Member" })).toHaveClass("py-3");

    rerender(
      <DataTable
        ariaLabel="Members table"
        caption="Members"
        columns={columns}
        dense
        rowKey={(row) => row.id}
        rows={rows.slice(0, 1)}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Member" })).toHaveClass("py-2");
  });
});
