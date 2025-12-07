declare module 'smiles-drawer' {
    namespace SmilesDrawer {
        class Drawer {
            constructor(options?: any);
            draw(tree: any, target: HTMLCanvasElement, theme?: string, infoOnly?: boolean): void;
        }
        
        class SvgDrawer {
            constructor(options?: any);
            draw(tree: any, target: SVGElement, theme?: string): void;
        }
        
        function parse(smiles: string, successCallback: (tree: any) => void, errorCallback?: (err: any) => void): void;
    }
    
    export = SmilesDrawer;
}
