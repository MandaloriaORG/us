import Link from "next/link";
import { redirect } from "next/navigation";

import { getCouncilAuditAccess } from "@/app/council/access";
import { NativeSelect } from "@/components/origin/native-select";
import { TextInput } from "@/components/origin/text-input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

import {
  auditActions,
  auditMaxPage,
  auditPageSize,
  parseAuditFilters,
  type AuditFilterField,
  type AuditFilterSearchParams,
  type AuditFilterValues,
} from "./audit-filters";
import { getAuditActionLabel, getAuditLogTotal, normalizeAuditLogRows } from "./audit-log-dto";
import { AuditLogTable } from "./audit-log-table";

export const dynamic = "force-dynamic";

interface CouncilAuditPageProps {
  searchParams?: AuditFilterSearchParams;
}

function auditPageHref(canonicalQuery: string, page: number) {
  const params = new URLSearchParams(canonicalQuery);

  if (page > 1) {
    params.set("page", String(page));
  } else {
    params.delete("page");
  }

  const query = params.toString();
  return query ? `/council/audit?${query}` : "/council/audit";
}

function renderAuditFilters(
  values: AuditFilterValues,
  errors: Partial<Record<AuditFilterField, string>>,
) {
  return (
    <form
      action="/council/audit"
      className="mt-6 grid gap-4 border-y border-border py-4 md:grid-cols-2 xl:grid-cols-[12rem_minmax(13rem,1fr)_minmax(13rem,1fr)_10rem_10rem_auto] xl:items-end"
      method="get"
    >
      <NativeSelect
        defaultValue={values.action}
        error={errors.action}
        id="audit-action"
        label="Action"
        name="action"
      >
        <option value="">All actions</option>
        {errors.action && values.action ? (
          <option value={values.action}>Unsupported: {values.action}</option>
        ) : null}
        {auditActions.map((action) => (
          <option key={action} value={action}>
            {getAuditActionLabel(action)}
          </option>
        ))}
      </NativeSelect>

      <TextInput
        autoComplete="off"
        defaultValue={values.actor}
        error={errors.actor}
        id="audit-actor"
        label="Actor ID"
        name="actor"
        placeholder="UUID"
        spellCheck={false}
        type="text"
      />

      <TextInput
        autoComplete="off"
        defaultValue={values.target}
        error={errors.target}
        id="audit-target"
        label="Target ID"
        name="target"
        placeholder="UUID"
        spellCheck={false}
        type="text"
      />

      <TextInput
        defaultValue={values.from}
        error={errors.from}
        id="audit-from"
        label="From"
        name="from"
        type={errors.from ? "text" : "date"}
      />

      <TextInput
        defaultValue={values.to}
        error={errors.to}
        id="audit-to"
        label="To"
        name="to"
        type={errors.to ? "text" : "date"}
      />

      <Button className="px-4" type="submit">
        Apply filters
      </Button>

      {errors.page ? (
        <p className="text-xs text-error md:col-span-2 xl:col-span-full" role="alert">
          Page: {errors.page}
        </p>
      ) : null}
    </form>
  );
}

export default async function CouncilAuditPage({ searchParams }: CouncilAuditPageProps) {
  const access = await getCouncilAuditAccess();

  if (!access.allowed) {
    if (access.reason === "verification_failed") {
      throw new Error("Council audit authorization could not be verified");
    }

    return null;
  }

  const filters = parseAuditFilters(searchParams);
  const hasFilters = Boolean(
    filters.values.action ||
    filters.values.actor ||
    filters.values.target ||
    filters.values.from ||
    filters.values.to,
  );
  const filterForm = renderAuditFilters(filters.values, filters.errors);

  if (!filters.valid) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Audit logs</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Review administrative account and role changes.
          </p>
        </div>

        {filterForm}

        <section aria-labelledby="audit-filter-errors-title" className="mt-6 max-w-xl">
          <h2 id="audit-filter-errors-title" className="text-base font-semibold text-fg">
            Check the audit filters
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            Correct the fields marked above before loading audit events.
          </p>
          <Button asChild className="mt-4" variant="secondary">
            <Link href="/council/audit">Clear filters</Link>
          </Button>
        </section>
      </div>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("council_list_audit_logs", filters.rpcArgs);

  if (error) {
    throw new Error("Council audit logs could not be loaded");
  }

  const auditLogs = normalizeAuditLogRows(data);
  let total = getAuditLogTotal(data);

  if (filters.page > 1 && auditLogs.length === 0) {
    const { data: firstPage, error: probeError } = await supabase.rpc("council_list_audit_logs", {
      ...filters.rpcArgs,
      p_limit: 1,
      p_offset: 0,
    });

    if (probeError) {
      throw new Error("Council audit logs could not be loaded");
    }

    total = getAuditLogTotal(firstPage);
  }

  const totalPages = Math.min(auditMaxPage, Math.max(1, Math.ceil(total / auditPageSize)));

  if (filters.page > totalPages) {
    redirect(auditPageHref(filters.canonicalQuery, totalPages));
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Audit logs</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Review administrative account and role changes.
        </p>
      </div>

      {filterForm}

      {hasFilters ? (
        <div className="mt-2 flex justify-end">
          <Link
            className="inline-flex min-h-11 items-center text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            href="/council/audit"
          >
            Clear filters
          </Link>
        </div>
      ) : null}

      <div className="mt-4">
        <AuditLogTable auditLogs={auditLogs} hasFilters={hasFilters} total={total} />
      </div>

      {totalPages > 1 ? (
        <nav
          aria-label="Audit log pagination"
          className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-4"
        >
          {filters.page > 1 ? (
            <Button asChild variant="secondary">
              <Link href={auditPageHref(filters.canonicalQuery, filters.page - 1)}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}

          <span className="text-sm tabular-nums text-fg-muted">
            Page {filters.page} of {totalPages}
          </span>

          {filters.page < totalPages ? (
            <Button asChild variant="secondary">
              <Link href={auditPageHref(filters.canonicalQuery, filters.page + 1)}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
