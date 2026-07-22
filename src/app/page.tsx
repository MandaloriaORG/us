import Link from "next/link";
import { CircleDot, MessageSquare, BookOpen, Shield, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        {/* Brand mark */}
        <div className="mb-8 flex items-center justify-center">
          <div className="rounded-full border border-brand/30 bg-brand-muted/20 p-4">
            <Shield className="h-10 w-10 text-brand" />
          </div>
        </div>

        <h1 className="font-display text-5xl font-bold tracking-tight text-fg sm:text-6xl">
          Mandaloria
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-fg-muted">
          A community and knowledge network for the Mandalorian philosophy. Plazas for discussion,
          Codex Libre for preserved knowledge, Holochat for live conversation, and Clans for
          belonging.
        </p>

        {/* Knowledge Pipeline — custom visualization placeholder */}
        <div className="mt-12 flex flex-wrap items-center gap-3 text-sm text-fg-muted">
          <span className="flex items-center gap-2 rounded-full border border-border px-4 py-2">
            <MessageSquare className="h-4 w-4" />
            Conversation
          </span>
          <ArrowRight className="h-4 w-4 text-fg-subtle" />
          <span className="flex items-center gap-2 rounded-full border border-border px-4 py-2">
            <CircleDot className="h-4 w-4" />
            Proposal
          </span>
          <ArrowRight className="h-4 w-4 text-fg-subtle" />
          <span className="flex items-center gap-2 rounded-full border border-border px-4 py-2">
            <Shield className="h-4 w-4" />
            Review
          </span>
          <ArrowRight className="h-4 w-4 text-fg-subtle" />
          <span className="flex items-center gap-2 rounded-full border border-brand/40 bg-brand-muted/10 px-4 py-2 text-brand">
            <BookOpen className="h-4 w-4" />
            Codex Article
          </span>
        </div>

        {/* CTA */}
        <div className="mt-12 flex gap-4">
          <Link
            href="/plazas"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-brand px-6 text-sm font-medium text-brand-fg transition-colors duration-fast hover:opacity-90"
          >
            Explore Plazas
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/codex"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border px-6 text-sm font-medium text-fg transition-colors duration-fast hover:bg-surface"
          >
            Codex Libre
          </Link>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<MessageSquare className="h-6 w-6" />}
            title="Plazas"
            description="Durable discussions organized by topic. Post, comment, react, and build collective wisdom."
            href="/plazas"
          />
          <FeatureCard
            icon={<BookOpen className="h-6 w-6" />}
            title="Codex Libre"
            description="Preserved knowledge with provenance. Every article links back to its source conversations."
            href="/codex"
          />
          <FeatureCard
            icon={<Shield className="h-6 w-6" />}
            title="Clans & Houses"
            description="Belong to a community structure. Earn ranks, badges, and take responsibility."
            href="/clans"
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-border bg-bg-raised p-6 transition-colors duration-fast hover:border-border-raised hover:bg-surface"
    >
      <div className="mb-4 text-brand">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-fg transition-colors duration-fast group-hover:text-brand">
        {title}
      </h3>
      <p className="text-sm text-fg-muted">{description}</p>
    </Link>
  );
}
