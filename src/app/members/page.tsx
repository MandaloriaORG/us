import { UsersIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SearchInput } from "@/components/origin/search-input";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listMemberProfiles } from "@/lib/actions/profile";

const MAX_PAGE = 40_001;

interface MembersPageProps {
  searchParams?: {
    page?: string | string[];
    q?: string | string[];
  };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= MAX_PAGE ? page : 1;
}

function pageHref(page: number, search: string) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/members?${query}` : "/members";
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const search = (firstValue(searchParams?.q) ?? "").trim().slice(0, 50);
  const page = parsePage(firstValue(searchParams?.page));
  const result = await listMemberProfiles({ search, page });

  if (result.status === "ok" && page > 1 && result.profiles.length === 0) {
    redirect(pageHref(1, search));
  }

  const totalPages =
    result.status === "ok" ? Math.max(1, Math.ceil(result.totalCount / result.pageSize)) : 1;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-fg text-2xl font-semibold">Members</h1>
      <p className="text-fg-muted mt-1 text-sm">
        The Mandalorian community — profiles, ranks, and clan affiliations.
      </p>

      <form
        action="/members"
        className="mt-8 flex flex-col items-end gap-3 sm:flex-row"
        method="get"
      >
        <SearchInput
          id="member-search"
          name="q"
          label="Search members"
          defaultValue={search}
          maxLength={50}
          placeholder="Search by display name"
          fieldClassName="flex-1"
        />
        <div className="flex min-h-11 items-center gap-2">
          <Button type="submit">Search</Button>
          {search ? (
            <Button asChild type="button" variant="secondary">
              <Link href="/members">Clear</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {result.status === "error" || result.status === "invalid" ? (
        <div role="alert">
          <EmptyState
            icon={<UsersIcon className="h-8 w-8" />}
            title="Members temporarily unavailable"
            description="We could not load the member directory. Try again."
            action={{ label: "Try again", href: pageHref(page, search) }}
            className="mt-8"
          />
        </div>
      ) : result.profiles.length > 0 ? (
        <>
          <p className="text-fg-muted mt-6 text-sm" role="status">
            {result.totalCount} {result.totalCount === 1 ? "member" : "members"}
          </p>
          <div className="divide-border border-border mt-3 divide-y rounded-md border">
            {result.profiles.map((member) => (
              <Link
                key={member.id}
                href={`/members/${member.id}`}
                className="duration-fast hover:bg-surface focus-visible:ring-border-focus flex min-h-16 items-center gap-4 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
              >
                <Avatar name={member.display_name} src={member.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <span className="text-fg text-sm font-medium wrap-break-word">
                    {member.display_name}
                  </span>
                  {member.bio ? (
                    <p className="text-fg-muted truncate text-xs">{member.bio}</p>
                  ) : null}
                  {member.roles.length > 0 ? (
                    <p className="text-fg-subtle mt-1 truncate text-xs">
                      {member.roles.join(", ")}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 ? (
            <nav
              aria-label="Member directory pages"
              className="mt-6 flex items-center justify-between gap-4"
            >
              {page > 1 ? (
                <Button asChild variant="secondary">
                  <Link href={pageHref(page - 1, search)}>Previous</Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-fg-muted text-sm">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Button asChild variant="secondary">
                  <Link href={pageHref(page + 1, search)}>Next</Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={<UsersIcon className="h-8 w-8" />}
          title={search ? "No matching members" : "No members yet"}
          description={
            search
              ? "Try another display name or clear the search."
              : "Be the first to join the community."
          }
          action={search ? { label: "Clear search", href: "/members" } : undefined}
          className="mt-8"
        />
      )}
    </main>
  );
}
