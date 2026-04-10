const fs = require('fs');
const path = require('path');

const filePath = './src/lib/smiles-drawer-lib.js';
const content = fs.readFileSync(filePath, 'utf8');

const search = 'determineDimensions';
const index = content.indexOf(search);

if (index === -1) {
    console.log('String not found');
} else {
    const start = Math.max(0, index - 100);
    const end = Math.min(content.length, index + 100);
    console.log('Context:', content.substring(start, end));
}
