import "server-only";

import { createClient as createServerClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Admin Supabase client — SERVICE ROLE. Server-only.
 * Never import this in client components or expose to the browser.
 *
 * Use only for operations that require elevated privileges:
 * - Managing users (list, ban, suspend)
 * - Assigning roles
 * - Audit log writes
 */
export function createAdminClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
