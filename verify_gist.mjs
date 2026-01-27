import { getGistFile, updateGistFile, appendToGistFile } from './shared/gistUtils.mjs';

const TEST_FILENAME = 'test_gist_utils.json';

async function verify() {
    console.log('Testing updateGistFile...');
    const testData = { hello: 'world', timestamp: new Date().toISOString() };
    const updateSuccess = await updateGistFile(TEST_FILENAME, testData);
    console.log(`Update success: ${updateSuccess}`);

    if (updateSuccess) {
        console.log('Testing getGistFile...');
        const fetchedData = await getGistFile(TEST_FILENAME);
        console.log('Fetched data:', fetchedData);

        if (JSON.stringify(fetchedData) === JSON.stringify(testData)) {
            console.log('Data integrity check PASSED');
        } else {
            console.log('Data integrity check FAILED');
        }

        console.log('Testing appendToGistFile...');
        const listData = ['item1', 'item2'];
        await updateGistFile(TEST_FILENAME, listData);
        const appendSuccess = await appendToGistFile(TEST_FILENAME, ['item3']);
        console.log(`Append success: ${appendSuccess}`);

        const finalData = await getGistFile(TEST_FILENAME);
        console.log('Final data:', finalData);
        if (Array.isArray(finalData) && finalData.includes('item3')) {
            console.log('Append check PASSED');
        } else {
            console.log('Append check FAILED');
        }
    }
}

verify();
