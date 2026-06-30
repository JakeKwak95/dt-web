const UNITY_CACHE_PREFIX = 'UnityCache_'
const UNITY_CACHE_DB_NAME = 'UnityCache'

/**
 * Unity WebGL stores downloaded Addressables/asset bundles in the Cache
 * Storage API (keyed "UnityCache_<companyName>_<productName>") plus request
 * metadata in an IndexedDB database named "UnityCache". Clearing both forces
 * the viewer to re-fetch the remote catalog and bundles on next load.
 */
export async function clearUnityAssetCache(): Promise<void> {
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith(UNITY_CACHE_PREFIX))
        .map((key) => caches.delete(key)),
    )
  }

  if ('indexedDB' in window) {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(UNITY_CACHE_DB_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  }
}
