import axios from 'axios';

const GIST_TOKEN = process.env.GIST_TOKEN;
const GIST_ID = process.env.GIST_ID;

/**
 * Fetches the content of a specific file from the configured Gist.
 * @param {string} fileName The name of the file to fetch.
 * @returns {Promise<any|null>} The parsed JSON content or null if not found/error.
 */
export async function getGistFile(fileName) {
    if (!GIST_TOKEN || !GIST_ID) {
        console.error('GIST_TOKEN or GIST_ID is missing.');
        return null;
    }

    try {
        const response = await axios.get(`https://api.github.com/gists/${GIST_ID}`, {
            headers: { 
                Authorization: `token ${GIST_TOKEN}`,
                'Cache-Control': 'no-cache'
            },
            params: { t: Date.now() } // キャッシュ回避
        });

        const file = response.data.files[fileName];
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
        console.error(`Failed to fetch Gist file ${fileName}:`, error.message);
        return null;
    }
}

/**
 * Updates or creates a file in the configured Gist.
 * @param {string} fileName The name of the file to update.
 * @param {any} data The data to save (will be stringified to JSON).
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export async function updateGistFile(fileName, data) {
    if (!GIST_TOKEN || !GIST_ID) {
        console.error('GIST_TOKEN or GIST_ID is missing.');
        return false;
    }

    try {
        await axios.patch(`https://api.github.com/gists/${GIST_ID}`, {
            files: {
                [fileName]: {
                    content: JSON.stringify(data, null, 2)
                }
            }
        }, {
            headers: { Authorization: `token ${GIST_TOKEN}` }
        });
        return true;
    } catch (error) {
        console.error(`Failed to update Gist file ${fileName}:`, error.response?.data || error.message);
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
