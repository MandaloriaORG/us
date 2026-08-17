import { UsersIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { SearchInput } from "@/components/origin/search-input";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export interface MemberSearchProfile {
  id: string;
  display_name: string;
  avatarUrl: string | null;
}

interface MemberSearchProps {
  /** The current query param (already validated by the caller). */
  search: string;
  /** The currently chosen member id, if any. */
  targetId?: string;
  /** Build the "choose this member" link from the current URL. */
  pickHref: (memberId: string, memberName: string) => string;
  /** Optional member to exclude (e.g. the clan leader when choosing a new one). */
  excludeMemberId?: string;
  /** Pre-loaded directory result: `null` while idle, "error" on failure. */
  profiles: MemberSearchProfile[] | "empty" | "error";
}

/**
 * Member directory picker: a search box that submits to the current page and
 * a result list whose rows "choose" a member by adding `target` to the URL.
 * The caller loads the directory (async work belongs to the page) and renders
 * its action form beside the choice. URL-driven so Back restores context.
 */
export function MemberSearch({
  search,
  targetId,
  pickHref,
  excludeMemberId,
  profiles,
}: MemberSearchProps) {
  return (
    <div className="flex flex-col gap-3">
      <form action="" method="get" className="flex flex-col items-end gap-3 sm:flex-row">
        <SearchInput
          id="member-search"
          name="q"
          label="Find a member"
          defaultValue={search}
          maxLength={50}
          placeholder="Search by display name"
          fieldClassName="flex-1"
        />
        <div className="flex min-h-11 items-center gap-2">
          <Button type="submit">Search</Button>
          {search ? (
            <Button asChild type="button" variant="secondary">
              <Link href=".">Clear</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {profiles === "error" ? (
        <EmptyState
          icon={<UsersIcon className="h-8 w-8" />}
          title="Members temporarily unavailable"
          description="We could not load the member directory. Try again."
        />
      ) : profiles === "empty" || !search ? (
        <p className="text-fg-subtle text-sm">
          Search for a member to {targetId ? "change the selection" : "choose one"}.
        </p>
      ) : profiles.length > 0 ? (
        <div className="border-border divide-border divide-y rounded-md border">
          {profiles
            .filter((member) => member.id !== excludeMemberId)
            .map((member) => (
              <Link
                key={member.id}
                href={pickHref(member.id, member.display_name)}
                aria-current={member.id === targetId ? "true" : undefined}
                className="duration-fast hover:bg-surface focus-visible:ring-border-focus flex min-h-11 items-center gap-3 px-3 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-hidden focus-visible:ring-inset"
              >
                <Avatar
                  name={member.display_name}
                  src={member.avatarUrl}
                  className="ring-brand/40 ring-offset-bg h-8 w-8 border-transparent ring-1 ring-offset-2"
                />
                <span className="text-fg truncate text-sm">{member.display_name}</span>
                {member.id === targetId ? (
                  <span className="text-fg-muted ml-auto text-xs">Selected</span>
                ) : null}
              </Link>
            ))}
        </div>
      ) : (
        <EmptyState
          icon={<UsersIcon className="h-8 w-8" />}
          title="No matching members"
          description="Try another display name."
        />
      )}
    </div>
  );
}
