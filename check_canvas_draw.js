const fs = require('fs');

// Mock DOM environment for Node.js
global.window = {};
global.document = {
    createElement: (tag) => {
        if (tag === 'canvas') {
            return {
                getContext: () => ({
                    font: '',
                    measureText: (text) => ({ width: text.length * 5 }),
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
                    rect: () => { },
                    translate: () => { },
                    lineWidth: 1,
                    lineCap: '',
                    strokeStyle: '',
                    fillStyle: '',
                    globalCompositeOperation: '',
                    textAlign: '',
                    textBaseline: '',
                    canvas: { width: 300, height: 300 }
                }),
                width: 300,
                height: 300,
                style: {},
                getAttribute: () => null,
                nodeName: 'CANVAS',
                tagName: 'CANVAS'
            };
        }
        return {
            setAttribute: () => { },
            setAttributeNS: () => { },
            appendChild: () => { },
            cloneNode: () => ({
                setAttribute: () => { },
                setAttributeNS: () => { },
                appendChild: () => { },
            })
        };
    },
    createElementNS: (ns, tag) => {
        return {
            setAttribute: () => { },
            setAttributeNS: () => { },
            appendChild: () => { },
            cloneNode: () => ({
                setAttribute: () => { },
                setAttributeNS: () => { },
                appendChild: () => { },
            }),
            style: {}
        };
    },
    querySelectorAll: () => [],
    getElementById: () => null,
};
global.window.document = global.document;
global.window.devicePixelRatio = 1;

// Load the library
// Since we appended "export default", this might be tricky in CommonJS node env
// But module.exports = SmilesDrawer is also at the bottom of the original file?
// Let's rely on standard require. 
// If it fails due to "export default" syntax error in Node (since it's not a module), we might need to strip it or us .mjs
// However, the user environment is Vite (bundler), which handles mixed syntax.
// Node.js might choke on "export default" if filename ends in .js and package.json doesn't say "type": "module".
// Yotsumasha-PCcursor-/package.json might not exist or specify type.

// Load the library
const libPath = './src/lib/smiles-drawer-lib.js';

// The library is a browser bundle, so it might not return anything useful on require.
// Instead, it should populate window.SmilesDrawer since we mocked window.
try {
    require(libPath);
} catch (e) {
    console.error("Require failed (ignoring export default error if any):", e.message);
}

const SmilesDrawer = global.window.SmilesDrawer;

if (!SmilesDrawer) {
    console.error("SmilesDrawer not found on window object!");
    process.exit(1);
}

console.log('Loaded SmilesDrawer keys:', Object.keys(SmilesDrawer));
console.log('SmilesDrawer.Drawer:', SmilesDrawer.Drawer);

const smilesList = [
    "c1ccccc1O",
    "Cc1ccccc1",
    "c1c2cc(O)ccc2ccc1"
];

const mockCanvas = global.document.createElement('canvas');
const options = { width: 300, height: 300 };

// In v2, the class is likely SmilesDrawer.Drawer or just SmilesDrawer.Drawer?
// The updated file has `SmilesDrawer.Drawer = Drawer`.
const Drawer = SmilesDrawer.Drawer;
const drawer = new Drawer(options);

console.log("Testing SMILES drawing...");

smilesList.forEach(s => {
    SmilesDrawer.parse(s, (tree) => {
        try {
            // draw(tree, canvas, theme, infoOnly)
            // Try passing null for theme to use default
            drawer.draw(tree, mockCanvas, null, false);
            console.log(`[DRAW OK] ${s}`);
        } catch (err) {
            console.error(`[DRAW FAIL] ${s}`);
            console.error('Error object:', err);
        }
    }, (err) => {
        console.error(`[PARSE FAIL] ${s}`, err);
    });
});
