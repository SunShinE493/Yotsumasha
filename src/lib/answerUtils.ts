
export function formatMeaning(meaning: string): string {
    if (!meaning) return meaning;
    const s = String(meaning);
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
