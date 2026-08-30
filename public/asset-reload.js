const reloadKey = 'rvm_missing_asset_reload_at';
const now = Date.now();
const previousReload = Number(window.sessionStorage?.getItem(reloadKey) || 0);

const clearCaches = async () => {
  if (!('caches' in window)) return;

  try {
    const keys = await window.caches.keys();
    await Promise.all(keys.map((key) => window.caches.delete(key)));
  } catch {
    // Keep reloading even if the browser blocks cache cleanup.
  }
};

const reloadWithFreshAssets = async () => {
  try {
    window.sessionStorage?.setItem(reloadKey, String(now));
  } catch {
    // Ignore storage failures and still try to recover the app.
  }

  await clearCaches();

  const url = new URL(window.location.href);
  url.searchParams.set('assetReload', String(now));
  window.location.replace(url.toString());
};

if (!previousReload || now - previousReload > 10000) {
  reloadWithFreshAssets();
} else {
  console.error('Asset missing after reload. Please clear the app cache manually.');
}

export default null;
