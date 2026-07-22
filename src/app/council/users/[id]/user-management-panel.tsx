"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  assignUserRole,
  removeUserRole,
  setUserStatus,
  type CouncilUserStatus,
} from "@/app/council/actions";
import { NativeSelect } from "@/components/origin/native-select";
import { StatusBadge } from "@/components/origin/status-badge";
import { Button } from "@/components/ui/button";

export interface CouncilRoleOption {
  id: string;
  name: string;
  description?: string | null;
  isProtected?: boolean;
}

export interface UserManagementPanelProps {
  targetUserId: string;
  currentStatus: CouncilUserStatus;
  assignedRoles: CouncilRoleOption[];
  assignableRoles: CouncilRoleOption[];
  canSuspend: boolean;
  canBan: boolean;
  canManageRoles: boolean;
  canManageProtectedRoles: boolean;
}

interface StatusTransition {
  status: CouncilUserStatus;
  label: string;
  permission: "suspend" | "ban";
  confirmation?: string;
}

const STATUS_TRANSITIONS: Record<CouncilUserStatus, StatusTransition[]> = {
  active: [
    {
      status: "suspended",
      label: "Suspend account",
      permission: "suspend",
      confirmation: "Suspend this member? They will lose access until the account is reactivated.",
    },
    {
      status: "banned",
      label: "Ban account",
      permission: "ban",
      confirmation: "Ban this member? They will lose access until the account is unbanned.",
    },
  ],
  suspended: [
    { status: "active", label: "Reactivate account", permission: "suspend" },
    {
      status: "banned",
      label: "Ban account",
      permission: "ban",
      confirmation: "Ban this member? They will lose access until the account is unbanned.",
    },
  ],
  banned: [{ status: "active", label: "Unban account", permission: "ban" }],
};

type Confirmation =
  | { kind: "status"; transition: StatusTransition }
  | { kind: "assign-role"; role: CouncilRoleOption }
  | { kind: "remove-role"; role: CouncilRoleOption };

type Feedback = { type: "error" | "success"; message: string };

const reasonErrorMessage = "Enter a reason between 3 and 500 characters.";

function validReason(reason: string) {
  const length = reason.trim().length;
  return length >= 3 && length <= 500;
}

export function UserManagementPanel({
  targetUserId,
  currentStatus,
  assignedRoles,
  assignableRoles,
  canSuspend,
  canBan,
  canManageRoles,
  canManageProtectedRoles,
}: UserManagementPanelProps) {
  const id = useId();
  const reasonId = `${id}-reason`;
  const reasonErrorId = `${id}-reason-error`;
  const confirmationTitleId = `${id}-confirmation-title`;
  const confirmationDescriptionId = `${id}-confirmation-description`;
  const pendingRef = useRef(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const confirmationTriggerRef = useRef<HTMLElement | null>(null);
  const hadConfirmationRef = useRef(false);

  const [status, setStatus] = useState(currentStatus);
  const [roles, setRoles] = useState(assignedRoles);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const transitions = STATUS_TRANSITIONS[status].filter(({ permission }) =>
    permission === "suspend" ? canSuspend : canBan,
  );
  const assignedRoleIds = new Set(roles.map((role) => role.id));
  const availableRoles = assignableRoles.filter((role) => !assignedRoleIds.has(role.id));
  const hasControls = transitions.length > 0 || canManageRoles;
  const reasonError = reasonTouched && !validReason(reason) ? reasonErrorMessage : undefined;
  const isPending = pendingAction !== null;

  useEffect(() => {
    if (confirmation) {
      hadConfirmationRef.current = true;
      confirmationRef.current?.focus();
      return;
    }

    if (hadConfirmationRef.current) {
      hadConfirmationRef.current = false;
      confirmationTriggerRef.current?.focus();
    }
  }, [confirmation]);

  if (!hasControls) return null;

  function requireReason() {
    setReasonTouched(true);
    return validReason(reason);
  }

  function clearIntentFeedback() {
    setConfirmation(null);
    setFeedback(null);
  }

  async function runMutation(
    key: string,
    mutation: () => ReturnType<typeof setUserStatus>,
    onSuccess: () => void,
    successMessage: string,
  ) {
    if (pendingRef.current || !requireReason()) return;

    pendingRef.current = true;
    setPendingAction(key);
    setFeedback(null);

    try {
      const result = await mutation();

      if (!result.ok) {
        setFeedback({ type: "error", message: result.message });
        return;
      }

      onSuccess();
      setReason("");
      setReasonTouched(false);
      setConfirmation(null);
      setFeedback({ type: "success", message: successMessage });
    } catch {
      setFeedback({
        type: "error",
        message: "The change could not be saved. Try again.",
      });
    } finally {
      pendingRef.current = false;
      setPendingAction(null);
    }
  }

  function requestStatusChange(event: React.MouseEvent<HTMLButtonElement>) {
    const transition = transitions.find((item) => item.status === selectedStatus);
    if (!transition || !requireReason()) return;

    if (transition.confirmation) {
      confirmationTriggerRef.current = event.currentTarget;
      setFeedback(null);
      setConfirmation({ kind: "status", transition });
      return;
    }

    void changeStatus(transition);
  }

  async function changeStatus(transition: StatusTransition) {
    await runMutation(
      `status:${transition.status}`,
      () =>
        setUserStatus({
          targetUserId,
          expectedStatus: status,
          status: transition.status,
          reason: reason.trim(),
        }),
      () => {
        setStatus(transition.status);
        setSelectedStatus("");
      },
      "Account status updated.",
    );
  }

  function assignSelectedRole(event: React.MouseEvent<HTMLButtonElement>) {
    const role = availableRoles.find((item) => item.id === selectedRoleId);
    if (!role || (role.isProtected && !canManageProtectedRoles)) return;

    if (role.isProtected) {
      if (!requireReason()) return;
      confirmationTriggerRef.current = event.currentTarget;
      setFeedback(null);
      setConfirmation({ kind: "assign-role", role });
      return;
    }

    void assignRole(role);
  }

  function assignRole(role: CouncilRoleOption) {
    void runMutation(
      `assign:${role.id}`,
      () => assignUserRole({ targetUserId, roleId: role.id, reason: reason.trim() }),
      () => {
        setRoles((current) => [...current, role]);
        setSelectedRoleId("");
      },
      `${role.name} role assigned.`,
    );
  }

  function requestRoleRemoval(event: React.MouseEvent<HTMLButtonElement>, role: CouncilRoleOption) {
    if (role.isProtected && !canManageProtectedRoles) return;
    if (!requireReason()) return;

    confirmationTriggerRef.current = event.currentTarget;
    setFeedback(null);
    setConfirmation({ kind: "remove-role", role });
  }

  async function removeConfirmedRole(role: CouncilRoleOption) {
    await runMutation(
      `remove:${role.id}`,
      () => removeUserRole({ targetUserId, roleId: role.id, reason: reason.trim() }),
      () => setRoles((current) => current.filter((item) => item.id !== role.id)),
      `${role.name} role removed.`,
    );
  }

  function confirmIntent() {
    if (!confirmation) return;

    if (confirmation.kind === "status") {
      void changeStatus(confirmation.transition);
      return;
    }

    if (confirmation.kind === "assign-role") {
      assignRole(confirmation.role);
      return;
    }

    void removeConfirmedRole(confirmation.role);
  }

  const confirmationKey =
    confirmation?.kind === "status"
      ? `status:${confirmation.transition.status}`
      : confirmation?.kind === "assign-role"
        ? `assign:${confirmation.role.id}`
        : confirmation
          ? `remove:${confirmation.role.id}`
          : "confirmation";

  return (
    <section className="mt-8 border-t border-border pt-6" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-lg font-semibold text-fg">
        Manage user
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        Changes are permission-checked and recorded in the Council audit log.
      </p>

      <div className="mt-5 flex max-w-xl flex-col gap-2">
        <label htmlFor={reasonId} className="text-sm font-medium text-fg">
          Reason
          <span aria-hidden="true" className="text-error">
            {" "}
            *
          </span>
          <span className="sr-only"> (required)</span>
        </label>
        <textarea
          id={reasonId}
          value={reason}
          required
          rows={3}
          maxLength={500}
          disabled={isPending}
          aria-describedby={reasonError ? reasonErrorId : undefined}
          aria-invalid={reasonError ? true : undefined}
          onBlur={() => setReasonTouched(true)}
          onChange={(event) => {
            setReason(event.target.value);
            if (reasonTouched) setReasonTouched(true);
          }}
          className="min-h-24 w-full resize-y rounded-md border border-border bg-bg px-3 py-2.5 text-sm text-fg outline-none transition-colors duration-fast placeholder:text-fg-subtle focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-border-focus/40 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:ring-error/30"
          placeholder="Explain why this change is needed"
        />
        {reasonError ? (
          <p id={reasonErrorId} className="text-xs text-error" role="alert">
            {reasonError}
          </p>
        ) : (
          <p className="text-xs text-fg-muted">3–500 characters. Visible in the audit record.</p>
        )}
      </div>

      {feedback ? (
        <p
          className={`mt-4 text-sm ${feedback.type === "error" ? "text-error" : "text-success"}`}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}

      {confirmation ? (
        <div
          ref={confirmationRef}
          className="mt-5 max-w-xl rounded-md bg-bg-raised p-4"
          role="group"
          tabIndex={-1}
          aria-live="assertive"
          aria-labelledby={confirmationTitleId}
          aria-describedby={confirmationDescriptionId}
        >
          <h3 id={confirmationTitleId} className="text-sm font-semibold text-fg">
            Confirm change
          </h3>
          <p id={confirmationDescriptionId} className="mt-1 text-sm text-fg-muted">
            {confirmation.kind === "status"
              ? confirmation.transition.confirmation
              : confirmation.kind === "assign-role"
                ? `Assign the protected ${confirmation.role.name} role to this member?`
                : `Remove the ${confirmation.role.name} role from this member?`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={confirmation.kind === "assign-role" ? "primary" : "destructive"}
              loading={pendingAction === confirmationKey}
              disabled={isPending}
              onClick={confirmIntent}
            >
              Confirm change
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {transitions.length > 0 ? (
        <div className="mt-6 max-w-xl border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-fg">Account status</h3>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <NativeSelect
              id={`${id}-status`}
              label="Change status"
              value={selectedStatus}
              disabled={isPending}
              onChange={(event) => {
                setSelectedStatus(event.target.value);
                clearIntentFeedback();
              }}
            >
              <option value="">Select a status</option>
              {transitions.map((transition) => (
                <option key={transition.status} value={transition.status}>
                  {transition.label}
                </option>
              ))}
            </NativeSelect>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              disabled={!selectedStatus || isPending}
              loading={pendingAction?.startsWith("status:")}
              onClick={requestStatusChange}
            >
              Review status change
            </Button>
          </div>
        </div>
      ) : null}

      {canManageRoles ? (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-fg">Roles</h3>

          {availableRoles.length > 0 ? (
            <div className="mt-3 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
              <NativeSelect
                id={`${id}-role`}
                label="Assign role"
                value={selectedRoleId}
                disabled={isPending}
                onChange={(event) => {
                  setSelectedRoleId(event.target.value);
                  clearIntentFeedback();
                }}
              >
                <option value="">Select a role</option>
                {availableRoles.map((role) => (
                  <option
                    key={role.id}
                    value={role.id}
                    disabled={role.isProtected && !canManageProtectedRoles}
                  >
                    {role.name}
                    {role.isProtected ? " (protected)" : ""}
                  </option>
                ))}
              </NativeSelect>
              <Button
                type="button"
                className="shrink-0"
                disabled={!selectedRoleId || isPending}
                loading={pendingAction?.startsWith("assign:")}
                onClick={assignSelectedRole}
              >
                Assign role
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-fg-muted">No additional roles are available.</p>
          )}

          <div className="mt-5 divide-y divide-border border-y border-border">
            {roles.length > 0 ? (
              roles.map((role) => {
                const protectedWithoutPermission =
                  Boolean(role.isProtected) && !canManageProtectedRoles;

                return (
                  <div
                    key={role.id}
                    className="flex min-h-14 items-center justify-between gap-3 px-1 py-2 sm:px-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="break-words text-sm font-medium text-fg">{role.name}</span>
                        {role.isProtected ? (
                          <StatusBadge tone="warning">Protected</StatusBadge>
                        ) : null}
                      </div>
                      {role.description ? (
                        <p className="mt-1 break-words text-xs text-fg-muted">{role.description}</p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="shrink-0"
                      disabled={protectedWithoutPermission || isPending}
                      aria-label={`Remove ${role.name} role`}
                      onClick={(event) => requestRoleRemoval(event, role)}
                    >
                      Remove
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="px-1 py-3 text-sm text-fg-muted">This member has no assigned roles.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
