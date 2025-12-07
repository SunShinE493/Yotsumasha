const fs = require('fs');
const content = fs.readFileSync('./src/lib/smiles-drawer-lib.js', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('class SvgDrawer')) {
        console.log('Found class SvgDrawer at line:', i + 1);
        // Dump constructor and draw method
        const slice = lines.slice(i, i + 100);
        console.log(slice.join('\n'));
        break;
    }
}
