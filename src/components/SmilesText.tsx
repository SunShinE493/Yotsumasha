import React, { useEffect, useRef, useState, useMemo } from 'react';
// @ts-ignore
import SmilesDrawer from '../lib/smiles-drawer-lib.js';//これで合ってた

interface SmilesTextProps {
    smiles: string;
    className?: string;
    width?: number;
    height?: number;
    variant?: 'default' | 'black';
}

export function SmilesText({ smiles, className, width = 180, height = 120, variant = 'default' }: SmilesTextProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const canvasId = useMemo(() => `smiles-canvas-${Math.random().toString(36).substr(2, 9)}`, []);

    useEffect(() => {
        if (!canvasRef.current || !smiles) {
            console.log('[SmilesText] No canvas or no smiles string provided.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        // Debug log to check library state at runtime
        console.log('[SmilesText] Processing SMILES:', `"${smiles}"`);
        console.log('[SmilesText] Library Keys:', Object.keys(SmilesDrawer));

        try {
            // Clean the smiles string using library helper if available (common in 1.x)
            const cleanSmiles = (SmilesDrawer as any).clean ? (SmilesDrawer as any).clean(smiles) : smiles;
            if (cleanSmiles !== smiles) {
                console.log('[SmilesText] Cleaned SMILES:', `"${cleanSmiles}"`);
            }

            const options: any = {
                width: width,
                height: height,
                bondThickness: 0.6,
            };

            // In 1.x, themes were often simpler or handled differently.
            // If black variant (for Battle), stick to defaults as requested.
            if (variant !== 'black') {
                options.themes = {
                    light: {
                        C: '#ffffff', N: '#33ff33', O: '#ff3333', P: '#ff9900', S: '#cccc00',
                        F: '#33ff33', Cl: '#196619', Br: '#ff3300', I: '#9900cc', H: '#ffffff',
                        BOND: '#ffffff', BACKGROUND: 'rgba(0,0,0,0)'
                    }
                };
            }

            const DrawerClass = SmilesDrawer.Drawer || (SmilesDrawer as any).SmiDrawer;
            if (!DrawerClass) {
                throw new Error('SmilesDrawer.Drawer class not found');
            }

            const drawer = new DrawerClass(options);
            const themeName = 'light'; // Always use light theme name, but options override it for non-black variant

            SmilesDrawer.parse(
                cleanSmiles,
                (tree: any) => {
                    console.log('[SmilesText] Parse success. Tree falsy?', !tree);
                    if (!tree) {
                        console.error('[SmilesText] Parse returned null/empty tree for:', cleanSmiles);
                        setError('Parse Error');
                        setIsLoading(false);
                        return;
                    }

                    // Delay slightly to ensure canvas is ready
                    setTimeout(() => {
                        const canvas = canvasRef.current || document.getElementById(canvasId);
                        if (!canvas) {
                            console.error('[SmilesText] Canvas element not found.');
                            setIsLoading(false);
                            return;
                        }

                        try {
                            console.log('[SmilesText] Attempting drawer.draw with theme:', themeName);
                            drawer.draw(tree, canvas as HTMLCanvasElement, themeName, false);
                            console.log('[SmilesText] Drawer.draw executed successfully');
                            setError(null);
                        } catch (drawErr: any) {
                            console.error('[SmilesText] Drawer.draw crashed:', drawErr);
                            setError('Draw Error');
                        }
                        setIsLoading(false);
                    }, 100);
                },
                (parseErr: any) => {
                    console.error('[SmilesText] Parse Error Callback:', parseErr);
                    setError('Parse Error');
                    setIsLoading(false);
                }
            );
        } catch (err: any) {
            console.error('[SmilesText] Initialization Error:', err);
            setError('Error');
            setIsLoading(false);
        }
    }, [smiles, width, height, variant, canvasId]);

    if (error) return <span className="text-destructive font-mono text-sm">{error}: {smiles}</span>;

    return (
        <div className={`inline-block ${className || ''}`}>
            <canvas
                ref={canvasRef}
                id={canvasId}
                width={width}
                height={height}
                className="max-w-full h-auto"
                data-testid="smiles-canvas"
                style={{ opacity: isLoading ? 0.5 : 1 }}
            />
        </div>
    );
}
