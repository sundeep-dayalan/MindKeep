/**
 * Post-build script to set up the offscreen document
 *
 * This script:
 * 1. Creates the offscreen directory
 * 2. Creates a standalone offscreen.js that loads the background bundle
 * 3. Creates the offscreen.html file
 */

const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, 'build', 'chrome-mv3-prod');
const OFFSCREEN_DIR = path.join(BUILD_DIR, 'offscreen');

console.log('📦 Setting up offscreen document...');

// Create offscreen directory
if (!fs.existsSync(OFFSCREEN_DIR)) {
  fs.mkdirSync(OFFSCREEN_DIR, { recursive: true });
  console.log('✅ Created offscreen directory');
}

// Copy the entire background bundle to make it accessible to the offscreen document
// The offscreen document will share the same code as the background script
const backgroundIndexPath = path.join(BUILD_DIR, 'static', 'background', 'index.js');
if (fs.existsSync(backgroundIndexPath)) {
  const offscreenJsPath = path.join(OFFSCREEN_DIR, 'offscreen.js');
  fs.copyFileSync(backgroundIndexPath, offscreenJsPath);
  console.log('✅ Copied background bundle to offscreen/offscreen.js');
} else {
  console.error('❌ Background bundle not found at:', backgroundIndexPath);
  process.exit(1);
}

// Create offscreen.html with proper CSP for WASM
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
`;

const offscreenHtmlPath = path.join(OFFSCREEN_DIR, 'offscreen.html');
fs.writeFileSync(offscreenHtmlPath, offscreenHtml);
console.log('✅ Created offscreen/offscreen.html');

console.log('✅ Offscreen document setup complete!');
