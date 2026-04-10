const fs = require('fs');
const filePath = './src/lib/smiles-drawer-lib.js';
const content = fs.readFileSync(filePath, 'utf8');

// Find module 6 definition:  6:[function(
const searchStr = '6:[function(';
const startIdx = content.indexOf(searchStr);

if (startIdx === -1) {
    console.log('Module 6 not found');
} else {
    // Print enough chars to see the constructor
    console.log(content.substring(startIdx, startIdx + 3000));
}
