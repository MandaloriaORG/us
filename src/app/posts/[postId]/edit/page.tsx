import Link from "next/link";
import { notFound } from "next/navigation";

import { PostForm } from "@/components/system/post-form";
import { EmptyState } from "@/components/ui/empty-state";
import { getPost } from "@/lib/content/queries";

/**
 * Edit an existing post. Gated on the already-computed `post.can_edit`;
 * `update_own_post` re-checks it, so a direct visit without permission sees a
 * plain denial rather than a form that would fail on submit.
 */
interface EditPostPageProps {
  params: Promise<{ postId: string }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { postId } = await params;
  if (!UUID_PATTERN.test(postId)) notFound();

  const post = await getPost(postId);
  if (!post) notFound();

  if (!post.can_edit || post.body === null) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <EmptyState
          title="You can't edit this post"
          description="You do not have permission to edit this post."
          action={{ label: "Back to post", href: `/posts/${postId}` }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <p className="text-fg-muted text-sm">
        <Link href={`/posts/${postId}`} className="hover:text-fg">
          {post.title}
        </Link>
      </p>
      <h1 className="text-fg mt-1 text-2xl font-semibold">Edit post</h1>
      <PostForm
        mode="edit"
        postId={post.id}
        initialTitle={post.title}
        initialBody={post.body}
        initialTagSlugs={post.tag_slugs}
      />
    </main>
  );
}
