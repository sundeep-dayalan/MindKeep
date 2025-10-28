const fs = require("fs")
const path = require("path")

const buildMode = process.argv[2] || "prod"
const BUILD_DIR = path.join(__dirname, "build", `chrome-mv3-${buildMode}`)
const OFFSCREEN_DIR = path.join(BUILD_DIR, "offscreen")

console.log(`📦 Setting up offscreen document for ${buildMode} build...`)

if (!fs.existsSync(OFFSCREEN_DIR)) {
  fs.mkdirSync(OFFSCREEN_DIR, { recursive: true })
  console.log("✅ Created offscreen directory")
}

const offscreenBuildPath = path.join(
  BUILD_DIR,
  "static",
  "offscreen",
  "index.js"
)
const backgroundIndexPath = path.join(
  BUILD_DIR,
  "static",
  "background",
  "index.js"
)

let sourcePath
if (fs.existsSync(offscreenBuildPath)) {
  sourcePath = offscreenBuildPath
  console.log("📄 Found dedicated offscreen build")
} else if (fs.existsSync(backgroundIndexPath)) {
  sourcePath = backgroundIndexPath
  console.log("📄 Using background bundle (includes offscreen code)")
} else {
  console.error("❌ No offscreen or background bundle found")
  console.error("  Looked for:", offscreenBuildPath)
  console.error("  Looked for:", backgroundIndexPath)
  process.exit(1)
}

const offscreenJsPath = path.join(OFFSCREEN_DIR, "offscreen.js")
fs.copyFileSync(sourcePath, offscreenJsPath)
console.log("✅ Copied bundle to offscreen/offscreen.js")

const offscreenHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:;">
    <title>MindKeep Offscreen Document</title>
  </head>
  <body>
    <!-- Offscreen document for shared database access -->
    <!-- This loads the same bundle as the background script -->
    <script src="offscreen.js" type="module"></script>
  </body>
</html>
`

const offscreenHtmlPath = path.join(OFFSCREEN_DIR, "offscreen.html")
fs.writeFileSync(offscreenHtmlPath, offscreenHtml)
console.log("✅ Created offscreen/offscreen.html")

console.log("✅ Offscreen document setup complete!")
