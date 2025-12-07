
export function formatMeaning(meaning: string): string {
    if (!meaning) return meaning;
    const s = String(meaning);

    // Split by / but preserve /r\d (used in r: type meanings)
    // Regex: Match / only if NOT followed by r and a digit
    const parts = s.split(/\/(?!r\d)/g);

    const formattedParts = parts.map(part => formatSingleMeaning(part));
    return formattedParts.join('/');
}

function formatSingleMeaning(s: string): string {
    if (s.startsWith('c:')) {
        const parts = s.split(':');
        return parts[parts.length - 1] || s;
    }
    if (s.startsWith('m:')) {
        const parts = s.split(':');
        // m:A:B -> A(B)
        if (parts.length >= 3) {
            return `${parts[1]}(${parts[2]})`;
        }
    }
    if (s.startsWith('r:')) {
        // r:1:C:H:O/r1/r1 -> C/H/O
        const parts = s.split(':');
        // parts[0]='r', parts[1]='1', items start from parts[2]
        const items = parts.slice(2);
        if (items.length > 0) {
            // Clean the last item if it has /r suffix
            const last = items[items.length - 1];
            if (last.includes('/r')) {
                items[items.length - 1] = last.split('/r')[0];
            }
            return items.join('/');
        }
    }
    return s;
}

export function validateAnswer(userInput: string, meaning: string): boolean {
    if (!userInput) return false;
    const input = normalize(userInput);
    const m = String(meaning);

    if (m.startsWith('c:')) {
        const parts = m.split(':');
        const correct = parts[parts.length - 1];
        return match(input, correct);
    }

    if (m.startsWith('m:')) {
        const parts = m.split(':');
        // m:A:B -> A or B (parts[1], parts[2]...)
        for (let i = 1; i < parts.length; i++) {
            if (match(input, parts[i])) return true;
        }
        return false;
    }

    if (m.startsWith('r:')) {
        // r:1:C:H:O/r1/r1 -> Check if input contains C, H, O (order independent)
        const parts = m.split(':');
        const items = parts.slice(2);
        if (items.length > 0) {
            const last = items[items.length - 1];
            if (last.includes('/r')) {
                items[items.length - 1] = last.split('/r')[0];
            }
        }
        // Validation: All items must be present in the input?
        // "CHOすべてが含まれていたら順番が違っても正解" -> "If C, H, O are all included"
        // Does "included" mean "present as substring" or "input is a permutation"?
        // Usually, for chemical formula-ish things like CHO, valid inputs are "CHO", "COH", "OHC" etc.
        // If input is "CH", it's wrong (missing O).
        // If input is "CHOO", is it wrong? (Duplicate O?)
        // The requirements say: "CHOすべてが含まれていたら" (If CHO are all included).
        // Let's assume strict permutation logic matching the characters/items?
        // But items might be "C", "H", "O". Input "CHO".
        // Or items "Na", "Cl". Input "NaCl".
        // I will normalize input and check if it *starts* with or *equals* the permutation?
        // Wait, regular match() does trim and slash check.
        // User said: "contained regardless of order".
        // Just checking ".includes()" for each item in the input string?
        // If items are C,H,O. Input "CHO" -> OK. Input "Alcohol" (has C, h, o, l) -> OK? Probably not.
        // Let's assume the user input should be generally equal to the combination of items, ignoring order.
        // Implementation: Check if input contains every item.
        // Ideally, check length matches too, but "included" is the keyword.
        // I'll check if every item is present in the input string.
        const normInput = input; // already normalized/trimmed
        return items.every(item => normInput.includes(item));
    }

    return match(input, m);
}

function normalize(s: string): string {
    return s.trim();
}

function match(input: string, target: string): boolean {
    const normTarget = normalize(target);
    // Direct match
    if (input === normTarget) return true;

    // Slash rule: "A/B" matches "AB" (input missing slash)
    if (normTarget.includes('/')) {
        const noSlashTarget = normTarget.replace(/\//g, '');
        if (input === noSlashTarget) return true;
    }

    return false;
}
