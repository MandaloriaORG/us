import type { Key, ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface DataTableColumn<TRow> {
  /** Stable identifier used as the React key for this column. */
  id: string;
  /** Renders the column heading. Interactive sorting belongs to the parent. */
  header: () => ReactNode;
  /** Renders one cell from the server-provided row. */
  cell: (row: TRow, rowIndex: number) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<TRow> {
  rows: readonly TRow[];
  columns: readonly DataTableColumn<TRow>[];
  rowKey: (row: TRow, rowIndex: number) => Key;
  /** Describes the table itself and is exposed through a semantic caption. */
  caption: string;
  /** Labels the keyboard-focusable horizontal scroll region. */
  ariaLabel: string;
  /** Use only in compact data/admin regions. */
  dense?: boolean;
  /** Specific reason/action rendered when `rows` is empty. */
  emptyState?: ReactNode;
  className?: string;
  tableClassName?: string;
}

/**
 * Lightweight, server-renderable data-table shell for exact comparison data.
 *
 * Adapted from ReUI's Data Grid container/table layout:
 * https://reui.io/docs/components/base/data-grid
 *
 * Use for bounded, server-provided rows whose search, filtering, sorting, and
 * pagination live in the parent URL state. Do not use for exploratory card
 * grids, client-side editing, virtualization, drag-and-drop, or unbounded data.
 * The component handles content and configurable empty states; loading, error,
 * denied, and pagination states remain local to the parent route. On narrow
 * screens the labelled, focusable region scrolls horizontally while preserving
 * native table, caption, heading, row, and cell semantics.
 */
export function DataTable<TRow>({
  rows,
  columns,
  rowKey,
  caption,
  ariaLabel,
  dense = false,
  emptyState = "No matching records.",
  className,
  tableClassName,
}: DataTableProps<TRow>) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "overflow-x-auto border-y border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
      role="region"
      tabIndex={0}
    >
      <table
        className={cn("w-full min-w-max border-collapse text-left text-sm text-fg", tableClassName)}
      >
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-bg-raised text-xs font-medium text-fg-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                className={cn(dense ? "px-3 py-2" : "px-3 py-3", column.headerClassName)}
                scope="col"
              >
                {column.header()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length > 0 ? (
            rows.map((row, rowIndex) => (
              <tr
                key={rowKey(row, rowIndex)}
                className="transition-colors focus-within:bg-surface hover:bg-surface"
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(dense ? "px-3 py-2" : "px-3 py-3", column.cellClassName)}
                  >
                    {column.cell(row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                className={cn(
                  "text-center text-sm text-fg-muted",
                  dense ? "px-3 py-6" : "px-3 py-8",
                )}
                colSpan={Math.max(columns.length, 1)}
              >
                {emptyState}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
