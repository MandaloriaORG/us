"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { MandaloriaLogo } from "@/components/layout/mandaloria-logo";

interface AuthShellProps {
  children: React.ReactNode;
}

const rise = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};

export function AuthShell({ children }: AuthShellProps) {
  const reduced = useReducedMotion();

  return (
    <main className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      {/* Ambient Beskar-gold glow — pure CSS, no images */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(42_40%_55%/0.10)_0%,transparent_62%)]" />
        <div className="absolute -top-32 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,hsl(42_40%_55%/0.06)_0%,transparent_60%)] blur-2xl" />
      </div>

      <motion.div
        initial={reduced ? false : "hidden"}
        animate="visible"
        variants={{
          hidden: { opacity: 0, y: 16 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
          },
        }}
        className="relative w-full max-w-sm"
      >
        <motion.div variants={rise} className="mb-7 flex justify-center">
          <Link
            href="/"
            aria-label="Mandaloria home"
            className="group border-brand/40 bg-bg-raised duration-fast focus-visible:ring-border-focus focus-visible:ring-offset-bg relative inline-flex h-14 w-14 items-center justify-center rounded-full border shadow-[0_0_24px_-4px_hsl(42_40%_55%/0.45),inset_0_1px_0_hsl(42_40%_55%/0.25)] transition-shadow hover:shadow-[0_0_34px_-6px_hsl(42_40%_55%/0.6),inset_0_1px_0_hsl(42_40%_55%/0.3)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-[radial-gradient(circle,hsl(42_40%_55%/0.18)_0%,transparent_70%)]"
            />
            <MandaloriaLogo
              gradientId="ml-auth"
              className="relative h-7 w-7 transition-transform group-hover:scale-105"
            />
          </Link>
        </motion.div>

        <motion.div
          variants={rise}
          className="border-border-raised bg-bg-raised/90 relative rounded-xl border p-6 shadow-[0_24px_60px_-30px_hsl(210_40%_0%/0.9),inset_0_1px_0_hsl(210_10%_24%/0.5)] backdrop-blur-sm sm:p-8"
        >
          {children}
        </motion.div>
      </motion.div>
    </main>
  );
}
