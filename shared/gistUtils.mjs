import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'gist_cache.json');
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const DEBOUNCE_DELAY = 5000; // 5 seconds debounce for Gist writes

// In-memory cache structure
let cache = {
    lastFetched: 0,
    files: {},
    dirty: {}
};

// Load cache from disk on startup
function initCache() {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        if (fs.existsSync(CACHE_FILE)) {
            const raw = fs.readFileSync(CACHE_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            cache = {
                lastFetched: parsed.lastFetched || 0,
                files: parsed.files || {},
                dirty: parsed.dirty || {}
            };
            console.log('[Gist Cache] Loaded local cache from disk. Cached files:', Object.keys(cache.files));
            
            // If there are unsynced changes from a previous run, trigger flush after a short delay
            const dirtyCount = Object.keys(cache.dirty).filter(k => cache.dirty[k]).length;
            if (dirtyCount > 0) {
                console.log(`[Gist Cache] Found ${dirtyCount} unsynced files. Scheduling startup sync...`);
                setTimeout(() => {
                    flushPendingUpdates();
                }, 2000);
            }
        }
    } catch (e) {
        console.error('[Gist Cache] Failed to initialize local cache:', e.message);
    }
}

// Save cache to disk
function saveCacheToDisk() {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    } catch (e) {
        console.error('[Gist Cache] Failed to save cache to disk:', e.message);
    }
}

// Run initialization
initCache();

/**
 * 環境変数からトークンとIDを取得し、余分な空白や引用符を除去します。
 * Koyebなどのクラウド環境の管理画面で誤って追加されがちな記号をクリーンアップします。
 */
function getGistConfig() {
    let token = process.env.GIST_TOKEN || '';
    let id = process.env.GIST_ID || '';
    
    // 余分な空白、改行、コーテーションを除去
    token = token.trim().replace(/^["']|["']$/g, '');
    id = id.trim().replace(/^["']|["']$/g, '');
    
    return { token, id };
}

// Background sync tracking
let syncTimeout = null;
let isSyncing = false;

// Flushes dirty cache files to GitHub Gist
async function flushPendingUpdates() {
    const { token, id } = getGistConfig();
    if (!token || !id) {
        console.warn('[Gist Cache] Skipping sync: Gist config missing.');
        return;
    }

    if (isSyncing) {
        // If already syncing, schedule another check soon
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(flushPendingUpdates, DEBOUNCE_DELAY);
        return;
    }

    // Get dirty files list
    const dirtyFiles = Object.keys(cache.dirty).filter(k => cache.dirty[k]);
    if (dirtyFiles.length === 0) {
        return;
    }

    isSyncing = true;
    console.log(`[Gist Cache] Syncing ${dirtyFiles.length} files to Gist... files:`, dirtyFiles);

    try {
        const filesPayload = {};
        for (const fileName of dirtyFiles) {
            filesPayload[fileName] = {
                content: cache.files[fileName]
            };
        }

        await axios.patch(`https://api.github.com/gists/${id}`, {
            files: filesPayload
        }, {
            headers: { 
                Authorization: `Bearer ${token}`,
                'User-Agent': 'MiniPotatoBot/1.0',
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        // Mark as clean
        for (const fileName of dirtyFiles) {
            delete cache.dirty[fileName];
        }
        saveCacheToDisk();
        console.log('[Gist Cache] Sync complete. All changes successfully mirrored to GitHub Gist.');
    } catch (error) {
        console.error('[Gist Cache] Sync failed:', error.response?.data || error.message);
        // Reschedule sync with linear backoff (15s)
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(flushPendingUpdates, 15000);
    } finally {
        isSyncing = false;
    }
}

// Ensure pending updates are written on process exit
process.on('SIGINT', () => {
    console.log('[Gist Cache] Process SIGINT received. Syncing dirty files to Gist...');
    flushPendingUpdatesSync();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log('[Gist Cache] Process SIGTERM received. Syncing dirty files to Gist...');
    flushPendingUpdatesSync();
    process.exit(0);
});

// Synchronous fallback for process exit
function flushPendingUpdatesSync() {
    saveCacheToDisk();
}

/**
 * Fetches the content of a specific file from the configured Gist.
 * Supports intelligent caching with 5-minute TTL.
 * @param {string} fileName The name of the file to fetch.
 * @returns {Promise<any|null>} The parsed JSON content or null if not found/error.
 */
export async function getGistFile(fileName) {
    const now = Date.now();
    const isCacheFresh = (now - cache.lastFetched) < CACHE_TTL;

    // If cache is fresh and contains the file, return it
    if (isCacheFresh && cache.files[fileName] !== undefined) {
        try {
            return JSON.parse(cache.files[fileName]);
        } catch (e) {
            console.error(`[Gist Cache] Failed to parse cached JSON for ${fileName}:`, e);
            return null;
        }
    }

    const { token, id } = getGistConfig();
    if (!token || !id) {
        console.warn('[Gist Cache] GIST_TOKEN or GIST_ID is missing. Serving from local cache fallback.');
        if (cache.files[fileName] !== undefined) {
            try {
                return JSON.parse(cache.files[fileName]);
            } catch {
                return null;
            }
        }
        return null;
    }

    console.log(`[Gist Cache] Cache expired or missing for ${fileName}. Fetching full Gist from GitHub...`);

    try {
        const response = await axios.get(`https://api.github.com/gists/${id}`, {
            headers: { 
                Authorization: `Bearer ${token}`,
                'Cache-Control': 'no-cache',
                'User-Agent': 'MiniPotatoBot/1.0',
                'Accept': 'application/vnd.github.v3+json'
            },
            params: { t: Date.now() } // Avoid cache
        });

        // Update entire cache with fetched Gist files
        cache.lastFetched = Date.now();
        const responseFiles = response.data.files;
        for (const [name, fileObj] of Object.entries(responseFiles)) {
            if (fileObj && fileObj.content) {
                cache.files[name] = fileObj.content;
                // If a file was dirty, check if the Gist actually has the same or newer content
                // For safety, only clear dirty if the content matches
                if (cache.dirty[name] && cache.files[name] === fileObj.content) {
                    delete cache.dirty[name];
                }
            }
        }
        saveCacheToDisk();

        const file = responseFiles[fileName];
        if (file && file.content) {
            try {
                return JSON.parse(file.content);
            } catch (e) {
                console.error(`Failed to parse Gist file ${fileName} as JSON:`, e);
                return null;
            }
        }
        return null;
    } catch (error) {
        console.error(`[Gist Cache] Failed to fetch Gist file ${fileName}:`, error.message);
        // Emits robust fallback from cache if available
        if (cache.files[fileName] !== undefined) {
            console.log(`[Gist Cache] Serving ${fileName} from local cache fallback after API failure.`);
            try {
                return JSON.parse(cache.files[fileName]);
            } catch {
                return null;
            }
        }
        return null;
    }
}

/**
 * Updates or creates a file in the configured Gist.
 * Compares content and only updates Gist if changes are detected.
 * @param {string} fileName The name of the file to update.
 * @param {any} data The data to save (will be stringified to JSON).
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export async function updateGistFile(fileName, data) {
    try {
        const newContent = JSON.stringify(data, null, 2);
        
        // 1. Change detection
        if (cache.files[fileName] === newContent) {
            console.log(`[Gist Cache] Content for ${fileName} is identical. Skipping Gist API call.`);
            return true;
        }

        console.log(`[Gist Cache] Content change detected for ${fileName}. Updating local cache.`);
        
        // 2. Update local in-memory and on-disk cache
        cache.files[fileName] = newContent;
        cache.dirty[fileName] = true;
        saveCacheToDisk();

        // 3. Queue debounced background sync
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(flushPendingUpdates, DEBOUNCE_DELAY);

        return true;
    } catch (error) {
        console.error(`[Gist Cache] Failed to update cache for ${fileName}:`, error.message);
        return false;
    }
}

/**
 * Appends entries to a JSON array in a Gist file.
 * @param {string} fileName The name of the file.
 * @param {any[]} newEntries The entries to append.
 * @returns {Promise<boolean>} True if successful.
 */
export async function appendToGistFile(fileName, newEntries) {
    const currentData = await getGistFile(fileName) || [];
    if (!Array.isArray(currentData)) {
        console.error(`Gist file ${fileName} is not an array.`);
        return false;
    }
    const updatedData = [...currentData, ...newEntries];
    return await updateGistFile(fileName, updatedData);
}
