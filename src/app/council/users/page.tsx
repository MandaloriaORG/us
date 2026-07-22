import { UserRoundSearch } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCouncilUserAccess } from "@/app/council/access";
import { NativeSelect } from "@/components/origin/native-select";
import { SearchInput } from "@/components/origin/search-input";
import { StatusBadge, type StatusBadgeTone } from "@/components/origin/status-badge";
import { DataTable, type DataTableColumn } from "@/components/reui/data-table";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";

const pageSize = 25;
const maxPage = 10_000;
const profileStatuses = ["active", "suspended", "banned"] as const;
const profileSorts = ["created_desc", "created_asc", "name_asc", "name_desc"] as const;

type ProfileStatus = (typeof profileStatuses)[number];
type ProfileSort = (typeof profileSorts)[number];

interface CouncilUserRow {
  createdAt: string | null;
  display_name: string;
  id: string;
  roleNames: string[];
  status: ProfileStatus | "unknown";
}

interface CouncilUsersPageProps {
  searchParams?: {
    page?: string | string[];
    q?: string | string[];
    sort?: string | string[];
    status?: string | string[];
  };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maxPage ? parsed : 1;
}

function parseStatus(value: string | undefined): ProfileStatus | undefined {
  return profileStatuses.find((status) => status === value);
}

function parseSort(value: string | undefined): ProfileSort {
  return profileSorts.find((sort) => sort === value) ?? "created_desc";
}

function pageHref(
  page: number,
  query: string,
  status: ProfileStatus | undefined,
  sort: ProfileSort,
) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  if (sort !== "created_desc") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/council/users?${search}` : "/council/users";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStatus(value: unknown): CouncilUserRow["status"] {
  return typeof value === "string" && profileStatuses.includes(value as ProfileStatus)
    ? (value as ProfileStatus)
    : "unknown";
}

function normalizeTimestamp(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

function normalizeUser(value: unknown): CouncilUserRow | null {
  if (!isRecord(value) || typeof value.id !== "string" || !uuidPattern.test(value.id)) {
    return null;
  }

  return {
    createdAt: normalizeTimestamp(value.created_at),
    display_name:
      typeof value.display_name === "string" && value.display_name.trim()
        ? value.display_name
        : "Unnamed member",
    id: value.id,
    roleNames: Array.isArray(value.role_names)
      ? value.role_names.filter((role): role is string => typeof role === "string")
      : [],
    status: normalizeStatus(value.status),
  };
}

function normalizeUsers(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((user) => {
        const normalized = normalizeUser(user);
        return normalized ? [normalized] : [];
      })
    : [];
}

function totalFrom(value: unknown) {
  if (!Array.isArray(value) || !isRecord(value[0])) return 0;
  const total = value[0].total_count;
  return typeof total === "number" && Number.isSafeInteger(total) && total >= 0 ? total : 0;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function CouncilUsersPage({ searchParams }: CouncilUsersPageProps) {
  const access = await getCouncilUserAccess();
  if (!access.allowed) {
    if (access.reason === "verification_failed") {
      throw new Error("Council authorization could not be verified");
    }
    return null;
  }

  const query = (firstValue(searchParams?.q) ?? "").trim().slice(0, 50);
  const status = parseStatus(firstValue(searchParams?.status));
  const sort = parseSort(firstValue(searchParams?.sort));
  const page = parsePage(firstValue(searchParams?.page));
  const rangeStart = (page - 1) * pageSize;
  const supabase = await createClient();
  const rpcArgs = {
    p_limit: pageSize,
    p_offset: rangeStart,
    p_search: query || undefined,
    p_sort: sort,
    p_status: status,
  };
  const { data, error } = await supabase.rpc("council_list_users", rpcArgs);

  if (error) {
    throw new Error("Council users could not be loaded");
  }

  const profiles = normalizeUsers(data);
  let total = totalFrom(data);

  if (page > 1 && profiles.length === 0) {
    const { data: firstPage, error: probeError } = await supabase.rpc("council_list_users", {
      ...rpcArgs,
      p_limit: 1,
      p_offset: 0,
    });
    if (probeError) {
      throw new Error("Council users could not be loaded");
    }
    total = totalFrom(firstPage);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(query || status || sort !== "created_desc");

  if (page > totalPages) {
    redirect(pageHref(totalPages, query, status, sort));
  }

  const statusTones: Record<ProfileStatus, StatusBadgeTone> = {
    active: "success",
    suspended: "warning",
    banned: "danger",
  };
  const columns: DataTableColumn<CouncilUserRow>[] = [
    {
      id: "member",
      header: () => "Member",
      cell: (user) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar alt="" name={user.display_name} />
          <Link
            href={`/council/users/${user.id}`}
            className="min-h-11 min-w-0 content-center break-words font-medium text-fg underline-offset-4 hover:text-brand hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus"
          >
            {user.display_name}
          </Link>
        </div>
      ),
    },
    {
      id: "roles",
      header: () => "Roles",
      cellClassName: "max-w-56 text-fg-muted",
      cell: (user) => {
        return (
          <span className="break-words">
            {user.roleNames.length > 0 ? user.roleNames.join(", ") : "No assigned roles"}
          </span>
        );
      },
    },
    {
      id: "status",
      header: () => "Status",
      cell: (user) => (
        <StatusBadge
          className="capitalize"
          tone={user.status === "unknown" ? "neutral" : statusTones[user.status]}
        >
          {user.status}
        </StatusBadge>
      ),
    },
    {
      id: "joined",
      header: () => "Joined",
      cellClassName: "tabular-nums text-fg-muted",
      cell: (user) =>
        user.createdAt ? (
          <time dateTime={user.createdAt}>
            {new Date(user.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </time>
        ) : (
          "Unknown"
        ),
    },
  ];

  const noUsers = (
    <EmptyState
      action={hasFilters ? { href: "/council/users", label: "Clear filters" } : undefined}
      description={
        hasFilters
          ? "Try a different name or account status."
          : "Registered members will appear here."
      }
      icon={<UserRoundSearch aria-hidden="true" className="h-6 w-6" />}
      title={hasFilters ? "No members match these filters" : "No members are available"}
    />
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Users</h1>
        <p className="mt-1 text-sm text-fg-muted">Review member access and account status.</p>
      </div>

      <form className="mt-6 grid gap-4 border-y border-border py-4 sm:grid-cols-2 sm:items-end lg:grid-cols-[minmax(0,1fr)_10rem_12rem_auto]">
        <SearchInput
          id="council-user-search"
          defaultValue={query}
          label="Search members"
          maxLength={50}
          name="q"
          placeholder="Display name"
        />

        <NativeSelect
          id="council-user-status"
          defaultValue={status ?? ""}
          label="Account status"
          name="status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </NativeSelect>

        <NativeSelect id="council-user-sort" defaultValue={sort} label="Sort users" name="sort">
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
        </NativeSelect>

        <Button type="submit" className="px-4">
          Apply filters
        </Button>
      </form>

      <div className="mt-4 flex min-h-6 items-center justify-between gap-4 text-sm text-fg-muted">
        <p aria-live="polite">{total === 1 ? "1 member" : `${total} members`}</p>
        {hasFilters && (
          <Link
            href="/council/users"
            className="inline-flex min-h-11 items-center text-fg-muted underline-offset-4 hover:text-fg hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus"
          >
            Clear filters
          </Link>
        )}
      </div>

      <DataTable
        ariaLabel="Council users"
        caption="Council users, their roles, account status, and join date"
        className="mt-4"
        columns={columns}
        emptyState={noUsers}
        rowKey={(user) => user.id}
        rows={profiles}
        tableClassName="min-w-[40rem]"
      />

      {totalPages > 1 && (
        <nav
          aria-label="User list pagination"
          className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-4"
        >
          {page > 1 ? (
            <Button asChild variant="secondary">
              <Link href={pageHref(page - 1, query, status, sort)}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm tabular-nums text-fg-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Button asChild variant="secondary">
              <Link href={pageHref(page + 1, query, status, sort)}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
