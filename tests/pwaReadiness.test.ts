import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CBT_ACTIVE_STORAGE_PREFIX,
  formatFriendlyNetworkError,
  hasActiveCBTExamSession,
  shouldAllowServiceWorkerReload,
} from '../src/lib/pwaProtection';

function runTests() {
  let passedCount = 0;
  const test = (name: string, fn: () => void) => {
    fn();
    passedCount += 1;
    console.log(`PASS: ${name}`);
  };

  // 1. Public PWA Icons & Assets Verification
  test('All required PNG and SVG PWA icon assets exist with valid headers', () => {
    const pngFiles = [
      'public/pwa-192x192.png',
      'public/pwa-512x512.png',
      'public/pwa-maskable-512x512.png',
      'public/apple-touch-icon.png',
    ];
    const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    for (const relPath of pngFiles) {
      const fullPath = path.resolve(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `Missing PNG icon: ${relPath}`);
      const buf = fs.readFileSync(fullPath);
      assert.ok(buf.length > 1000, `Icon too small: ${relPath}`);
      assert.ok(buf.subarray(0, 8).equals(PNG_SIG), `Invalid PNG signature: ${relPath}`);
    }

    const svgPath = path.resolve(process.cwd(), 'public/icon.svg');
    assert.ok(fs.existsSync(svgPath), 'Missing public/icon.svg');
    assert.ok(fs.readFileSync(svgPath, 'utf8').includes('<svg'));
  });

  // 2. index.html PWA Meta & SEO Integrity
  test('index.html includes iOS/Android PWA meta tags while preserving SEO title and description', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    assert.ok(html.includes('<title>DIVINE ACADEMY SECONDARY SCHOOL Portal</title>'));
    assert.ok(html.includes('viewport-fit=cover'));
    assert.ok(html.includes('name="theme-color" content="#091932"'));
    assert.ok(html.includes('name="apple-mobile-web-app-capable" content="yes"'));
    assert.ok(html.includes('rel="apple-touch-icon" href="/apple-touch-icon.png"'));
    assert.ok(html.includes('rel="icon" type="image/svg+xml" href="/icon.svg"'));
  });

  // 3. VitePWA Configuration & Strict Supabase/CBT NetworkOnly Protection
  test('vite.config.ts configures safe manifest, separate any/maskable icons, prompt updates, and NetworkOnly Supabase rules', () => {
    const viteCfg = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    assert.ok(viteCfg.includes("registerType: 'prompt'"));
    assert.ok(viteCfg.includes("short_name: 'DivineAcad'"));
    assert.ok(viteCfg.includes("display: 'standalone'"));
    assert.ok(viteCfg.includes("start_url: '/'"));
    assert.ok(viteCfg.includes("scope: '/'"));
    assert.ok(viteCfg.includes("purpose: 'any'"));
    assert.ok(viteCfg.includes("purpose: 'maskable'"));
    assert.equal(viteCfg.includes('any maskable'), false);
    assert.ok(viteCfg.includes('skipWaiting: false'));
    assert.ok(viteCfg.includes('clientsClaim: false'));
    assert.ok(viteCfg.includes("handler: 'NetworkOnly'"));
    assert.ok(viteCfg.includes('supabase\\.co'));
    assert.ok(viteCfg.includes('devOptions:'));
  });

  // 4. Built Manifest & Service Worker Output Verification (when dist exists)
  test('Production dist/ contains generated manifest.webmanifest and sw.js with NetworkOnly Supabase rule', () => {
    const distManifestPath = path.resolve(process.cwd(), 'dist/manifest.webmanifest');
    const distSwPath = path.resolve(process.cwd(), 'dist/sw.js');
    assert.ok(fs.existsSync(distManifestPath), 'dist/manifest.webmanifest must exist after build');
    assert.ok(fs.existsSync(distSwPath), 'dist/sw.js must exist after build');

    const manifest = JSON.parse(fs.readFileSync(distManifestPath, 'utf8'));
    assert.equal(manifest.id, '/');
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.display, 'standalone');
    assert.ok(manifest.short_name.length <= 12, 'short_name must be <= 12 characters');
    assert.ok(manifest.icons.some((i: any) => i.sizes === '192x192' && i.purpose === 'any'));
    assert.ok(manifest.icons.some((i: any) => i.sizes === '512x512' && i.purpose === 'any'));
    assert.ok(manifest.icons.some((i: any) => i.sizes === '512x512' && i.purpose === 'maskable'));

    const swCode = fs.readFileSync(distSwPath, 'utf8');
    assert.ok(swCode.includes('supabase'));
    assert.ok(swCode.includes('NetworkOnly'));
  });

  // 5. CBT Active Session Service Worker Reload Guard
  test('CBT exam guard blocks PWA reload whenever an exam session is active', () => {
    const origWindow = (globalThis as any).window;
    try {
      const store = new Map<string, string>();
      (globalThis as any).window = {
        sessionStorage: {
          get length() {
            return store.size;
          },
          key(idx: number) {
            return Array.from(store.keys())[idx] ?? null;
          },
          getItem(k: string) {
            return store.get(k) ?? null;
          },
        },
      };

      assert.equal(hasActiveCBTExamSession(), false);
      assert.equal(shouldAllowServiceWorkerReload(), true);

      store.set(`${CBT_ACTIVE_STORAGE_PREFIX}std-1`, 'exam-math-01');
      assert.equal(hasActiveCBTExamSession(), true);
      assert.equal(shouldAllowServiceWorkerReload(), false);

      store.clear();
      assert.equal(hasActiveCBTExamSession(), false);
      assert.equal(shouldAllowServiceWorkerReload(), true);
    } finally {
      (globalThis as any).window = origWindow;
    }
  });

  // 6. Network Error Message Translation
  test('formatFriendlyNetworkError translates low-level fetch errors without leaking raw internals', () => {
    const fetchErr = formatFriendlyNetworkError(new TypeError('Failed to fetch'));
    assert.ok(fetchErr.includes('Network connection interrupted'));
    const timeoutErr = formatFriendlyNetworkError(new Error('Request timed out'));
    assert.ok(timeoutErr.includes('took too long to respond'));
  });

  // 7. Integration & Supabase Session Persistence Integrity
  test('Header installs PWAInstallButton (desktop, mobileBar, drawer), App mounts update guard & lazy portals, and Supabase session persistence stays enabled', () => {
    const headerSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/common/Header.tsx'), 'utf8');
    const installBtnSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/common/PWAInstallButton.tsx'), 'utf8');
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const runnerSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/student/CBTExamRunner.tsx'), 'utf8');
    const supabaseSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/supabase.ts'), 'utf8');

    assert.ok(installBtnSrc.includes('Install School App'));
    assert.ok(headerSrc.includes('<PWAInstallButton variant="header" />'));
    assert.ok(headerSrc.includes('<PWAInstallButton variant="mobileBar" />'));
    assert.ok(headerSrc.includes('<PWAInstallButton variant="mobile" />'));
    assert.ok(appSrc.includes('<PWAConnectivityAndUpdateBar />'));
    assert.ok(appSrc.includes('lazy(() =>'));
    assert.ok(runnerSrc.includes('data-cbt-exam-active'));
    assert.ok(supabaseSrc.includes('persistSession: true'));
    assert.ok(supabaseSrc.includes('autoRefreshToken: true'));
  });

  console.log(`\nAll ${passedCount} PWA readiness & CBT protection tests passed.`);
}

runTests();
