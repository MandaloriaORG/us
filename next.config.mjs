const storageOrigin = (() => {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    return {
      protocol: url.protocol === "http:" ? "http" : "https",
      hostname: url.hostname,
      port: url.port,
      pathname: "/storage/v1/object/**",
    };
  } catch {
    return null;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // The action enforces a 5 MiB file limit; this only leaves room for multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
  images: {
    // Never let next/image turn a user-controlled profile value into an arbitrary server fetch.
    remotePatterns: storageOrigin ? [storageOrigin] : [],
  },
};

export default nextConfig;
