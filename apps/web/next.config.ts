import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ワークスペースのパッケージは TypeScript のソースのまま参照する(ADR-0002)
  transpilePackages: ['@ota/platform', '@ota/shared'],
  typedRoutes: true,
  typescript: {
    // 型チェックは turbo の typecheck タスク(TypeScript 7 の tsc)で行う(ADR-0012)
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
