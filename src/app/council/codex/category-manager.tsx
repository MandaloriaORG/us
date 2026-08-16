"use client";

import { useState, useTransition } from "react";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/origin/native-select";
import { TextInput } from "@/components/origin/text-input";
import { setCategoryStatus, upsertCategory } from "@/lib/actions/codex";
import type { CodexCategory } from "@/lib/codex/queries";

export function CategoryManager({ categories }: { categories: CodexCategory[] }) {
  const [showForm, setShowForm] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors(undefined);
    setError(null);
    startTransition(async () => {
      const result = await upsertCategory({
        slug,
        name,
        description,
        sortOrder: Number(sortOrder) || 0,
      });
      if (!result.ok) {
        setError(result.message);
        setFieldErrors(result.fieldErrors);
        return;
      }
      setSlug("");
      setName("");
      setDescription("");
      setShowForm(false);
    });
  }

  // `list_codex_categories` only returns active categories, so an archived one
  // leaves the manager; reactivating it needs an Archivist surface that can list
  // archived categories, which the read RPC does not provide.
  function archive(category: CodexCategory, reason: string) {
    void (async () => {
      const result = await setCategoryStatus({
        slug: category.slug,
        expectedStatus: "active",
        status: "archived",
        reason,
      });
      if (!result.ok) {
        setError(result.message);
      }
    })();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-fg text-lg font-semibold" id="categories-heading">
            Categories
          </h2>
          <p className="text-fg-muted mt-1 text-sm">
            The shelves of the library. Archiving one keeps its articles readable but hides the
            category from the public list.
          </p>
        </div>
        <Button
          onClick={() => setShowForm((value) => !value)}
          size="md"
          type="button"
          variant="secondary"
        >
          <PlusIcon aria-hidden="true" className="h-4 w-4" />
          {showForm ? "Close form" : "Add or edit a category"}
        </Button>
      </div>

      {showForm ? (
        <form className="mt-4 flex max-w-xl flex-col gap-3" onSubmit={onSubmit}>
          <TextInput
            error={fieldErrors?.slug}
            id="category-slug"
            label="Slug"
            onChange={(event) => setSlug(event.target.value)}
            placeholder="culture"
            value={slug}
          />
          <TextInput
            error={fieldErrors?.name}
            id="category-name"
            label="Name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Culture"
            value={name}
          />
          <TextInput
            error={fieldErrors?.description}
            id="category-description"
            label="Description"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
          <TextInput
            error={fieldErrors?.sortOrder}
            id="category-sort"
            label="Sort order"
            onChange={(event) => setSortOrder(event.target.value)}
            type="number"
            value={sortOrder}
          />
          {error ? (
            <p className="text-error text-xs" role="alert">
              {error}
            </p>
          ) : null}
          <div>
            <Button disabled={pending} loading={pending} type="submit">
              Save category
            </Button>
          </div>
        </form>
      ) : null}

      {categories.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {categories.map((category) => (
            <li
              className="border-border flex flex-wrap items-center gap-2 rounded-md border p-3"
              key={category.id}
            >
              <span className="text-fg text-sm font-medium">{category.name}</span>
              <span className="text-fg-subtle text-xs">{category.slug}</span>
              {category.description ? (
                <span className="text-fg-muted text-sm">{category.description}</span>
              ) : null}
              <div className="ml-auto">
                <ArchiveButton onArchive={(reason) => archive(category, reason)} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-muted mt-4 text-sm">No categories yet.</p>
      )}
    </div>
  );
}

function ArchiveButton({ onArchive }: { onArchive: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" type="button" variant="ghost">
        Archive
      </Button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onArchive(reason);
        setOpen(false);
      }}
    >
      <NativeSelect
        className="w-40"
        id="archive-reason"
        label="Reason"
        onChange={(event) => setReason(event.target.value)}
        value={reason}
      >
        <option value="">Reason…</option>
        <option value="Superseded by another category">Superseded by another category</option>
        <option value="No longer needed">No longer needed</option>
        <option value="Consolidated into a broader category">
          Consolidated into a broader category
        </option>
      </NativeSelect>
      <Button disabled={!reason} size="sm" type="submit">
        Confirm
      </Button>
      <Button onClick={() => setOpen(false)} size="sm" type="button" variant="ghost">
        Cancel
      </Button>
    </form>
  );
}
