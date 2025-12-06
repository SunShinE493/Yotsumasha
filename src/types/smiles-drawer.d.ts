declare module 'smiles-drawer' {
    export default class SmiDrawer {
        constructor(options: any);
        draw(data: string, target: HTMLElement, theme?: string, infoOnly?: boolean): void;
    }
}

declare module 'smiles-drawer/dist/smiles-drawer.min.js' {
    export default class SmiDrawer {
        constructor(options: any);
        draw(data: string, target: HTMLElement, theme?: string, infoOnly?: boolean): void;
    }
}
