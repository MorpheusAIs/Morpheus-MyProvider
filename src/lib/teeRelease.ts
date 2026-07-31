/**
 * Resolve the latest stable digest-pinned SecretVM compose from GitHub Releases.
 * Never uses the mutable :latest tag.
 *
 * CRITICAL: compose YAML must be copied byte-for-byte into SecretVM.
 * Do not trim, re-indent, or otherwise mutate `composeText` after fetch.
 *
 * Browser note: release *asset* downloads redirect to release-assets.githubusercontent.com
 * without CORS. In local/dev we proxy via Vite (/gh-api, /gh-download). We also ship a
 * same-origin copy under /tee/ that matches the pinned release asset.
 */

export interface TeeComposeRelease {
  tag: string;
  downloadUrl: string;
  /** Exact release-asset body — copy this verbatim into SecretVM */
  composeText: string;
  imageLine: string | null;
  imageDigest: string | null;
  /** SHA-256 of composeText (UTF-8) — matches CI "Generated deployed compose" digest when sources match */
  composeSha256: string;
  publishedAt: string;
  source: 'github' | 'bundled';
}

interface GhRelease {
  tag_name: string;
  prerelease: boolean;
  published_at: string;
  assets: { name: string; browser_download_url: string; url: string }[];
}

const ASSET_NAME = 'docker-compose.tee.deployed.yml';

function useGithubProxy(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

function apiUrl(path: string): string {
  return useGithubProxy() ? `/gh-api${path}` : `https://api.github.com${path}`;
}

function downloadUrl(browserDownloadUrl: string): string {
  if (!useGithubProxy()) return browserDownloadUrl;
  return browserDownloadUrl.replace(/^https:\/\/github\.com/, '/gh-download');
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function parseComposeMeta(
  composeText: string,
  tag: string,
  downloadUrl: string,
  publishedAt: string,
  source: TeeComposeRelease['source']
): Promise<TeeComposeRelease> {
  // Keep exact bytes — never trim. SecretVM attestation / paste is whitespace-sensitive.
  const imageMatch = composeText.match(
    /^\s*image:\s*(ghcr\.io\/morpheusais\/morpheus-lumerin-node-tee@sha256:[a-f0-9]+)/m
  );
  const imageLine = imageMatch?.[1] ?? null;
  const digestMatch = imageLine?.match(/sha256:[a-f0-9]+/);
  return {
    tag,
    downloadUrl,
    composeText,
    imageLine,
    imageDigest: digestMatch?.[0] ?? null,
    composeSha256: await sha256Hex(composeText),
    publishedAt,
    source,
  };
}

async function fetchBundledFallback(): Promise<TeeComposeRelease | null> {
  try {
    const [metaRes, ymlRes] = await Promise.all([
      fetch('/tee/meta.json'),
      fetch('/tee/docker-compose.tee.deployed.yml'),
    ]);
    if (!metaRes.ok || !ymlRes.ok) return null;
    const meta = (await metaRes.json()) as { tag: string; publishedAt?: string; downloadUrl?: string };
    // text() preserves body as decoded string; bundled file is LF UTF-8 matching the release asset
    const composeText = await ymlRes.text();
    if (!composeText.includes('morpheus-lumerin-node-tee@sha256:')) return null;
    return parseComposeMeta(
      composeText,
      meta.tag || 'bundled',
      meta.downloadUrl ||
        'https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases/download/v7.5.0/docker-compose.tee.deployed.yml',
      meta.publishedAt || '',
      'bundled'
    );
  } catch {
    return null;
  }
}

/**
 * Prefer live GitHub asset when reachable; fall back to same-origin /tee/ bundle.
 * Returned composeText is unmodified release bytes (as Unicode string).
 */
export async function fetchLatestTeeCompose(): Promise<TeeComposeRelease> {
  // Always try GitHub first so "Fetch latest" can pick up newer releases than the bundle.
  try {
    const res = await fetch(
      apiUrl('/repos/MorpheusAIs/Morpheus-Lumerin-Node/releases?per_page=30'),
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (res.ok) {
      const releases = (await res.json()) as GhRelease[];
      const stable = releases.find(
        (r) =>
          !r.prerelease &&
          !/-test|-dev/i.test(r.tag_name) &&
          r.assets.some((a) => a.name === ASSET_NAME)
      );
      const fallback = releases.find((r) => r.assets.some((a) => a.name === ASSET_NAME));
      const pick = stable || fallback;
      if (pick) {
        const asset = pick.assets.find((a) => a.name === ASSET_NAME)!;
        const url = downloadUrl(asset.browser_download_url);
        const composeRes = await fetch(url);
        if (composeRes.ok) {
          const composeText = await composeRes.text();
          // Reject HTML error pages / empty — fall through to bundle
          if (
            composeText.includes('morpheus-lumerin-node-tee@sha256:') &&
            !composeText.trimStart().startsWith('<!')
          ) {
            return parseComposeMeta(
              composeText,
              pick.tag_name,
              asset.browser_download_url,
              pick.published_at,
              'github'
            );
          }
        }
      }
    }
  } catch {
    // fall through
  }

  const bundled = await fetchBundledFallback();
  if (bundled) return bundled;
  throw new Error('Could not load digest-pinned docker-compose.tee.deployed.yml');
}
