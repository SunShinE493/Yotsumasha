const fs = require('fs');
const content = fs.readFileSync('./src/lib/smiles-drawer-lib.js', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('class Drawer')) {
        console.log('Found class Drawer at line:', i + 1);
        // Print next 500 lines to find draw method
        // console.log(lines.slice(i, i + 500).join('\n'));
        break;
    }
}
