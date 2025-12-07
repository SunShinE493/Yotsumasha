const fs = require('fs');
const content = fs.readFileSync('./src/lib/smiles-drawer-lib.js', 'utf8');

// We know module 6 is Drawer. Look for "6:[function"
const search = '6:[function';
const idx = content.indexOf(search);
if (idx === -1) {
    console.log("Could not find start of module 6");
} else {
    // Read 5000 chars from there
    console.log(content.substring(idx, idx + 5000));
}
