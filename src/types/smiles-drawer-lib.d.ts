declare module '*/smiles-drawer-lib.js' {
    export class Drawer {
        constructor(options: any);
        draw(tree: any, target: any, theme?: string, infoOnly?: boolean): void;
    }
    export function parse(smiles: string, successCallback: (tree: any) => void, errorCallback?: (err: any) => void): void;

    // Catch-all for other exports if needed, though strictly named exports are preferred with 'import *'
    const _default: any;
    export default _default;
}
