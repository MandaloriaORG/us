"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EyeIcon, PencilLineIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/origin/native-select";
import { TextInput } from "@/components/origin/text-input";
import { Textarea } from "@/components/origin/textarea";
import { createArticle } from "@/lib/actions/codex";
import { slugify } from "@/lib/codex/slug";
import { renderMarkdown } from "@/lib/content/markdown";
import type { CodexCategory } from "@/lib/codex/queries";

export function ArticleForm({
  categories,
  initialTitle = "",
}: {
  categories: CodexCategory[];
  initialTitle?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState("");
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? "");
  const [body, setBody] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [preview, setPreview] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const suggestedSlug = slug || slugify(title);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors(undefined);
    setError(null);

    startTransition(async () => {
      const result = await createArticle({
        categorySlug,
        title,
        slug,
        body,
        excerpt,
      });

      if (!result.ok) {
        setError(result.message);
        setFieldErrors(result.fieldErrors);
        return;
      }

      router.push(`/council/codex/${result.slug}/edit`);
      router.refresh();
    });
  }

  return (
    <form className="mt-5 flex flex-col gap-4" onSubmit={onSubmit}>
      <div className="grid gap-4 lg:grid-cols-2">
        <TextInput
          error={fieldErrors?.title}
          id="article-title"
          label="Title"
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />
        <TextInput
          description={
            slug ? undefined : `If left blank, the slug will be “${suggestedSlug || "…"}”.`
          }
          error={fieldErrors?.slug}
          id="article-slug"
          label="Slug"
          onChange={(event) => setSlug(event.target.value)}
          placeholder={slugify(title) || "the-vows"}
          value={slug}
        />
      </div>

      <NativeSelect
        error={fieldErrors?.categorySlug}
        id="article-category"
        label="Category"
        onChange={(event) => setCategorySlug(event.target.value)}
        value={categorySlug}
      >
        {categories.map((category) => (
          <option key={category.id} value={category.slug}>
            {category.name}
          </option>
        ))}
      </NativeSelect>

      <TextInput
        error={fieldErrors?.excerpt}
        id="article-excerpt"
        label="Excerpt"
        onChange={(event) => setExcerpt(event.target.value)}
        placeholder="A short summary shown in the library list"
        value={excerpt}
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-fg text-sm font-medium" htmlFor="article-body">
            Body (Markdown)
          </label>
          <Button
            onClick={() => setPreview((value) => !value)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {preview ? (
              <>
                <PencilLineIcon aria-hidden="true" className="h-4 w-4" />
                Edit
              </>
            ) : (
              <>
                <EyeIcon aria-hidden="true" className="h-4 w-4" />
                Preview
              </>
            )}
          </Button>
        </div>
        {preview ? (
          <div
            className="text-fg border-border [&_a]:text-brand min-h-40 rounded-md border p-4 text-sm leading-relaxed [&_a]:underline-offset-4 [&_a:hover]:underline [&_p]:mt-3 [&_p:first-child]:mt-0"
            data-testid="article-preview"
            // Safe by construction: renderMarkdown escapes author text first.
            dangerouslySetInnerHTML={{ __html: renderMarkdown(body, { maxLength: 100_000 }) }}
          />
        ) : (
          <Textarea
            aria-invalid={fieldErrors?.body ? true : undefined}
            id="article-body"
            onChange={(event) => setBody(event.target.value)}
            rows={16}
            value={body}
          />
        )}
        {fieldErrors?.body ? (
          <p className="text-error text-xs" role="alert">
            {fieldErrors.body}
          </p>
        ) : null}
      </div>

      {error && !fieldErrors ? (
        <p className="text-error text-xs" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <Button disabled={pending || !categorySlug} loading={pending} type="submit">
          Save draft
        </Button>
      </div>
    </form>
  );
}
