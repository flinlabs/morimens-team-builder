/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lint runs separately via `npm run lint`; don't fail production builds on
  // lint-only issues (e.g. unused scaffolding vars in lib/).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
