import type { NextConfig } from "next";

const r2Host = (() => {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return null;
  try {
    return new URL(base).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Seminar entries are read off disk; keep the markdown in the deployed bundle.
  outputFileTracingIncludes: {
    "/seminar": ["./content/seminar/**/*"],
    "/seminar/[slug]": ["./content/seminar/**/*"],
  },
  images: {
    remotePatterns: r2Host
      ? [{ protocol: "https", hostname: r2Host }]
      : [],
  },
};

export default nextConfig;
