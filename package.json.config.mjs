/**
 * Plasmo configuration for build optimization
 * This strips console logs from production builds
 */
export default function (config) {
  // Only apply console stripping in production builds
  if (process.env.NODE_ENV === "production") {
    config.esbuild = {
      ...config.esbuild,
      drop: ["console", "debugger"]
    }
  }

  return config
}
