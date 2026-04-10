const strings = [
    "smiles:c1ccccc1O: この構造式で表される(　)は常温で(　)で FeCl₃aq と反応して(　)を示す。",
    "smiles:c1ccccc1[O-][Na+]:フェノールばナトリウムと反応し(　)となる。",
    "smiles:Cc1c(O)cccc1:この構造式で表される(　)は常温で(　)で FeCl₃aq と反応して(　)を示す。",
    "smiles:O=C(O)c1ccccc1O:この構造式で表される(　)は常温で(　)で FeCl₃aq と反応して(　)を示す。"
];

function parse(text) {
    if (text.startsWith('smiles:')) {
        const rest = text.substring(7); // Remove "smiles:"
        const colonIndex = rest.indexOf(':');

        if (colonIndex !== -1) {
            const smilesString = rest.substring(0, colonIndex).trim();
            const displayString = rest.substring(colonIndex + 1).trim();
            return { smiles: smilesString, display: displayString, validSplit: true };
        } else {
            const smilesString = rest.trim();
            return { smiles: smilesString, display: null, validSplit: false };
        }
    }
    return null;
}

strings.forEach(s => {
    console.log(`Input: ${s}`);
    const result = parse(s);
    console.log(`Parsed:`, result);
    console.log('---');
});
