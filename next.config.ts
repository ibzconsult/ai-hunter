import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build em modo standalone — gera .next/standalone com o mínimo pra rodar
  // em container (sem node_modules completo). Essencial pro Dockerfile.
  output: 'standalone',
  // KB upload aceita até 20MB (definido em /api/knowledge/upload).
  // Default do Next 16 é 10MB — eleva o teto pra cobrir o limite do app.
  ...({ middlewareClientMaxBodySize: 25 * 1024 * 1024 } as object),
};

export default nextConfig;
