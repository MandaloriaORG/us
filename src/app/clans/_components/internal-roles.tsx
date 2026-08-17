"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { NativeSelect } from "@/components/origin/native-select";
import { TextInput } from "@/components/origin/text-input";
import { Button } from "@/components/ui/button";
import { assignInternalRole, removeInternalRole, upsertInternalRole } from "@/lib/actions/clans";
import type { ClanActionResult } from "@/lib/clans/errors";
import { KNOWN_CLAN_INTERNAL_PERMISSIONS } from "@/lib/clans/labels";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";



const TEXTAREA_CLASS =
  "border-border bg-bg text-fg duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-border-focus/40 aria-invalid:border-error aria-invalid:focus-visible:ring-error/30 min-h-20 w-full resize-y rounded-md border px-3 py-2 text-sm outline-hidden transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

export interface InternalRoleView {
  internalRoleId: string;
  name: string;
  description: string;
  permissions: string[];
  memberCount: number;
}

interface AssignableMember {
  memberId: string;
  displayName: string;
}

interface InternalRolesProps {
  clanId: string;
  slug: string;
  roles: InternalRoleView[];
  members: AssignableMember[];
}

/**
 * Clan internal-role management: define roles with basic capability
 * permissions, remove them, and assign members to them. The RPCs re-check that
 * the caller leads the clan (or is an admin) on every mutation.
 */
export function InternalRoles({ clanId, slug, roles, members }: InternalRolesProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [assignRoleId, setAssignRoleId] = useState(roles[0]?.internalRoleId ?? "");
  const [assignMemberId, setAssignMemberId] = useState(members[0]?.memberId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function togglePermission(value: string) {
    setPermissions((current) =>
      current.includes(value) ? current.filter((p) => p !== value) : [...current, value],
    );
  }

  function run(
    action: (input: Record<string, unknown>) => Promise<ClanActionResult>,
    input: Record<string, unknown>,
    message: string,
  ) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await action(input);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(result.message ?? message);
      setName("");
      setDescription("");
      setPermissions([]);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-6">
      {error ? (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-success flex items-center gap-1.5 text-sm">
          <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
          {success}
        </p>
      ) : null}

      {/* Existing roles */}
      {roles.length > 0 ? (
        <div className="border-border divide-border divide-y rounded-md border">
          {roles.map((role) => (
            <div
              key={role.internalRoleId}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-fg text-sm font-medium">{role.name}</p>
                {role.description ? (
                  <p className="text-fg-muted mt-0.5 text-xs">{role.description}</p>
                ) : null}
                {role.permissions.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {role.permissions.map((permission) => (
                      <span
                        key={permission}
                        className="border-border text-fg-subtle inline-flex rounded-sm border px-1.5 py-0.5 text-[0.6875rem]"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="text-fg-subtle mt-1 text-xs">
                  {role.memberCount} {role.memberCount === 1 ? "member" : "members"} assigned
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() =>
                    run(
                      removeInternalRole,
                      { clanId, slug, internalRoleId: role.internalRoleId },
                      "Role removed.",
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-fg-subtle text-sm">No internal roles yet. Create the first one below.</p>
      )}

      {/* New role */}
      <div className="border-border border-t pt-5">
        <h3 className="text-fg text-sm font-semibold">New internal role</h3>
        <div className="mt-3 flex max-w-xl flex-col gap-4">
          <TextInput
            id="internal-role-name"
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={60}
            placeholder="e.g. Archivist"
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="internal-role-description" className="text-fg text-sm font-medium">
              Description <span className="text-fg-subtle font-normal">(optional)</span>
            </label>
            <Textarea
              id="internal-role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={500}
              className={TEXTAREA_CLASS}
            />
          </div>
          <fieldset>
            <legend className="text-fg text-sm font-medium">Permissions</legend>
            <div className="mt-2 flex flex-col gap-2">
              {KNOWN_CLAN_INTERNAL_PERMISSIONS.map((permission) => (
                <label
                  key={permission.value}
                  className="text-fg-muted flex items-center gap-2 text-sm"
                >
                  <Input
                    type="checkbox"
                    checked={permissions.includes(permission.value)}
                    onChange={() => togglePermission(permission.value)}
                    className="h-4 w-4"
                  />
                  {permission.label}
                  <span className="text-fg-subtle font-mono text-xs">{permission.value}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Button
              type="button"
              loading={isPending}
              disabled={isPending || name.trim().length < 2}
              onClick={() =>
                run(
                  upsertInternalRole,
                  { clanId, slug, name, description, permissions },
                  "Role saved.",
                )
              }
            >
              Create role
            </Button>
          </div>
        </div>
      </div>

      {/* Assignment */}
      {roles.length > 0 && members.length > 0 ? (
        <div className="border-border border-t pt-5">
          <h3 className="text-fg text-sm font-semibold">Assign role to member</h3>
          <div className="mt-3 flex max-w-2xl flex-col gap-4">
            <div className="flex flex-col gap-5 sm:flex-row">
              <NativeSelect
                id="assign-role"
                label="Role"
                value={assignRoleId}
                onChange={(event) => setAssignRoleId(event.target.value)}
                fieldClassName="sm:max-w-xs"
              >
                {roles.map((role) => (
                  <option key={role.internalRoleId} value={role.internalRoleId}>
                    {role.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                id="assign-member"
                label="Member"
                value={assignMemberId}
                onChange={(event) => setAssignMemberId(event.target.value)}
                fieldClassName="sm:max-w-xs"
              >
                {members.map((member) => (
                  <option key={member.memberId} value={member.memberId}>
                    {member.displayName}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(
                    assignInternalRole,
                    {
                      clanId,
                      slug,
                      memberId: assignMemberId,
                      internalRoleId: assignRoleId,
                      remove: false,
                    },
                    "Role assigned.",
                  )
                }
              >
                Assign
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={() =>
                  run(
                    assignInternalRole,
                    {
                      clanId,
                      slug,
                      memberId: assignMemberId,
                      internalRoleId: assignRoleId,
                      remove: true,
                    },
                    "Assignment removed.",
                  )
                }
              >
                Remove assignment
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
