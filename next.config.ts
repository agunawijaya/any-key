import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The default (bottom-left in Next 16, top-left before) covered the logo and the back button.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
