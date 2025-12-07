const fs = require('fs');
const path = require('path');

global.window = {};
global.document = {
    createElement: () => ({
        getContext: () => ({
            font: '',
            measureText: () => ({ width: 0 }),
            setTransform: () => { },
            scale: () => { },
            save: () => { },
            beginPath: () => { },
            arc: () => { },
            closePath: () => { },
            fill: () => { },
            stroke: () => { },
            restore: () => { },
            moveTo: () => { },
            lineTo: () => { },
            createLinearGradient: () => ({ addColorStop: () => { } }),
            createRadialGradient: () => ({ addColorStop: () => { } }),
            setLineDash: () => { },
            fillText: () => { },
            clearRect: () => { },
        }),
        setAttribute: () => { },
        setAttributeNS: () => { },
    }),
    querySelectorAll: () => [],
    getElementById: () => null,
};
global.window.document = global.document;

const libPath = './src/lib/smiles-drawer-lib.js';
let SmilesDrawer;

try {
    require(libPath);
    if (global.window.SmilesDrawer) {
        SmilesDrawer = global.window.SmilesDrawer;
    } else {
        SmilesDrawer = require(libPath);
    }
} catch (e) {
    console.error("Failed to load library:", e);
    process.exit(1);
}

const smilesList = [
    "c1ccccc1O",
    "Cc1c(O)cccc1",
    "Cc1cc(O)ccc1",
    "Cc1ccc(O)cc1",
    "c1c2c(O)cccc2ccc1",
    "c1c2cc(O)ccc2ccc1",
    "O=C(O)c1ccccc1O",
    "c1ccccc1[O-][Na+]",
    "O=C(O)C1=CC=CC=C1",
    "OC(=O)C1=C(C(=O)O)C=CC=C1",
    "O=C(O)C1=CC=CC(C(=O)O)=C1",
    "O=C(O)C1=CC=C(C(=O)O)C=C1",
    "O=C(O)C1=CC=CC=C1O"
];

console.log("Checking SMILES strings...");

smilesList.forEach(s => {
    try {
        SmilesDrawer.parse(s, (tree) => {
            console.log(`[OK] ${s}`);
        }, (err) => {
            console.error(`[FAIL] ${s} - Error:`, err);
        });
    } catch (e) {
        console.error(`[CRASH] ${s} - Exception:`, e);
    }
});
