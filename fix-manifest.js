const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, 'build', 'chrome-mv3-dev', 'manifest.json');

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Update CSP to allow WASM
  if (manifest.content_security_policy && manifest.content_security_policy.extension_pages) {
    // Replace the entire CSP with a clean version that includes wasm-unsafe-eval
    manifest.content_security_policy.extension_pages = 
      "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'";
  }
  
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✅ Manifest CSP updated to allow WASM');
}
