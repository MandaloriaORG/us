import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CodexHeader } from "@/app/codex/codex-header";
import { ProposeForm } from "@/app/codex/propose/propose-form";

export const metadata: Metadata = {
  title: "Propose for the Codex",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ProposePageProps {
  searchParams: Promise<{
    post?: string;
    comment?: string;
    external?: string;
  }>;
}

export default async function ProposePage({ searchParams }: ProposePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/codex/propose");

  const params = await searchParams;
  const post = typeof params.post === "string" ? params.post : "";
  const comment = typeof params.comment === "string" ? params.comment : "";
  const external = typeof params.external === "string" ? params.external : "";

  // Exactly one source, and a post or comment source must be a real uuid. A
  // hand-edited URL degrades to a 404 rather than a broken form.
  const sourceCount = [post, comment, external].filter(Boolean).length;
  if (sourceCount > 1) notFound();
  if (post && !UUID_PATTERN.test(post)) notFound();
  if (comment && !UUID_PATTERN.test(comment)) notFound();
  if (external && !/^https?:\/\/\S+$/.test(external.trim())) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <CodexHeader signedIn={true} />
      <h1 className="text-fg mt-6 text-xl font-semibold">Propose for the Codex</h1>
      <p className="text-fg-muted mt-1 text-sm">
        Explain why this conversation deserves to become reviewed knowledge. An Archivist will
        classify it, verify its sources and credit its contributors.
      </p>
      <ProposeForm
        initialExternal={external}
        initialPostId={post || null}
        initialCommentId={comment || null}
      />
    </main>
  );
}
