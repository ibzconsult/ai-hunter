import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build em modo standalone — gera .next/standalone com o mínimo pra rodar
  // em container (sem node_modules completo). Essencial pro Dockerfile.
  output: 'standalone',
};

export default nextConfig;
