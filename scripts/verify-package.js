const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apps = path.join(root, 'apps');

const checks = [
  { name: 'API Dist', path: path.join(apps, 'api', 'dist', 'index.js') },
  { name: 'API Migrations', path: path.join(apps, 'api', 'src', 'db', 'migrations') },
  { name: 'Web Dist', path: path.join(apps, 'web', 'dist', 'index.html') },
  { name: 'Desktop Dist', path: path.join(apps, 'desktop', 'dist', 'main.js') },
  { name: 'Electron Builder Config', path: path.join(apps, 'desktop', 'electron-builder.json5') }
];

console.log('--- DMS SOULUTION Package Verification ---');

let failed = false;
checks.forEach(check => {
  if (fs.existsSync(check.path)) {
    console.log(`[PASS] ${check.name}`);
  } else {
    console.log(`[FAIL] ${check.name} - Missing at: ${check.path}`);
    failed = true;
  }
});

if (failed) {
  console.error('\nVerification FAILED. Please ensure all projects are built.');
  process.exit(1);
} else {
  console.log('\nVerification SUCCESS. All assets are ready for packaging.');
}
