// Helper to check if a difficulty value matches selected constraints
function isDifficultySelected(d: string, selected?: (number | string)[]): boolean {
    if (!selected || selected.length === 0) return true;
    return selected.some(s => String(s) === d);
}

export function formatMeaning(meaning: string, difficulty?: number | string | null, selectedDifficulties?: (number | string)[]): string {
    if (!meaning) return meaning;
    const s = String(meaning);

    // Split by / but preserve /r\d (used in r: type meanings)
    const parts = s.split(/\/(?!r\d)/g);

    // Apply difficulty filtering if applicable
    let filteredParts = parts;
    if (difficulty !== undefined && difficulty !== null && selectedDifficulties && selectedDifficulties.length > 0) {
        const diffStr = String(difficulty);
        // Only apply splitting logic if difficulty contains separator
        if (diffStr.includes(';')) {
            const diffParts = diffStr.split(';').map(d => d.trim());
            // Map meaning parts to difficulties. 
            // Assumption: 1-to-1 mapping. If lengths differ, fallback to showing all or matching indices?
            // "difficulty が2;3 ... 答えも 答え1/答え2" -> implies 1-to-1
            filteredParts = parts.filter((_, i) => {
                const d = diffParts[i];
                return !d || isDifficultySelected(d, selectedDifficulties);
            });
            if (filteredParts.length === 0) {
                // If all filtered out (shouldn't happen if word was selected), show nothing or original?
                // Logic says "If diff 3... do not display". So empty string.
                return "";
            }
        }
    }

    const formattedParts = filteredParts.map(part => formatSingleMeaning(part));
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

    // Check against formatted display string as well (e.g. m:A:B -> A(B))
    // Requirement: "m: は答え(答え) のように変換されていると思いますが、この場合はどちらかが入っていれば丸になるようにしてください"
    // Also "答えとして表示する文字列を使って正誤判定をし"
    if (match(input, formatMeaning(m))) return true;

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
        // Requirement: "含まれる語は順不同で丸にする" -> Every item must be present
        const normInput = input;
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
