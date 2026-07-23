import Link from "next/link";
import { notFound } from "next/navigation";

import { PostForm } from "@/components/system/post-form";
import { EmptyState } from "@/components/ui/empty-state";
import { getPlaza } from "@/lib/content/queries";

/**
 * Compose a new post in a specific Plaza. Composing is substantial work, so it
 * is a page, not a dialog. `can_post` only gates the affordance; `create_post`
 * re-checks it, so a visitor who lands here without permission sees a plain
 * denial rather than a form that would fail on submit.
 */
interface NewPostPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewPostPage({ params }: NewPostPageProps) {
  const { slug } = await params;
  const plaza = await getPlaza(slug);
  if (!plaza) notFound();

  if (!plaza.can_post) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <EmptyState
          title="You can't post here"
          description={`You do not have permission to create a post in ${plaza.name}.`}
          action={{ label: `Back to ${plaza.name}`, href: `/plazas/${slug}` }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <p className="text-fg-muted text-sm">
        <Link href={`/plazas/${slug}`} className="hover:text-fg">
          {plaza.name}
        </Link>
      </p>
      <h1 className="text-fg mt-1 text-2xl font-semibold">New post</h1>
      <PostForm mode="create" plazaId={plaza.id} />
    </main>
  );
}
