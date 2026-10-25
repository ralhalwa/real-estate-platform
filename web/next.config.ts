import type { NextConfig } from 'next';
const config: NextConfig = { output: 'export', distDir: process.env.BAYT_BUILD_DIR || '.next', images: { unoptimized: true } };
export default config;
