const fs = require('fs');
const path = require('path');

global.window = {};
global.document = {
    createElement: () => ({
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
        } else {
            SmilesDrawer = require(libPath);
        }
    } catch(e) {
        console.error("Failed to load library:", e);
        process.exit(1);
    }

const smilesList = [
        "c1ccccc1O",
        "c1ccccc1[O-][Na+]"
    ];

    const mockCanvas = global.document.createElement('canvas');
    mockCanvas.width = 300;
    mockCanvas.height = 300;
    mockCanvas.style = {}; // Mock style object

    console.log("Testing SMILES drawing...");

    const options = { width: 300, height: 300 };
    const drawer = new SmilesDrawer.Drawer(options);

    smilesList.forEach(s => {
        SmilesDrawer.parse(s, (tree) => {
            try {
                drawer.draw(tree, mockCanvas, 'light', false);
                console.log(`[DRAW OK] ${s}`);
            } catch (err) {
                console.error(`[DRAW FAIL] ${s}`, err);
            }
        }, (err) => {
            console.error(`[PARSE FAIL] ${s}`, err);
        });
    });
