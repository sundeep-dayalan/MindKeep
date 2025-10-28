const fs = require("fs")
const path = require("path")

const manifestPath = path.join(
  __dirname,
  "build",
  "chrome-mv3-dev",
  "manifest.json"
)

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

  if (
    manifest.content_security_policy &&
    manifest.content_security_policy.extension_pages
  ) {

    manifest.content_security_policy.extension_pages =
      "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log("✅ Manifest CSP updated to allow WASM")
}
