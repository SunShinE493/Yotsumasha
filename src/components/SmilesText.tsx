import React, { useEffect, useRef, useState } from 'react';
import SmilesDrawer from '../lib/smiles-drawer-lib.js';

interface SmilesTextProps {
    smiles: string;
    className?: string;
    width?: number;
    height?: number;
}

export function SmilesText({ smiles, className, width = 300, height = 200 }: SmilesTextProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!canvasRef.current || !smiles) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const options = {
                width: width,
                height: height
            };

            const drawer = new SmilesDrawer.Drawer(options);

            SmilesDrawer.parse(
                smiles,
                (tree: any) => {
                    try {
                        if (canvasRef.current) {
                            drawer.draw(tree, canvasRef.current, 'light', false);
                            console.log('[SmilesText] Draw success:', smiles);
                        }
                        setError(null);
                    } catch (drawErr: any) {
                        console.error('[SmilesText] Failed to draw SMILES:', drawErr, 'String:', smiles);
                        setError('Invalid SMILES');
                    }
                    setIsLoading(false);
                },
                (parseErr: any) => {
                    console.error('[SmilesText] Failed to parse SMILES:', parseErr, 'String:', smiles);
                    setError('Invalid SMILES');
                    setIsLoading(false);
                }
            );
        } catch (err: any) {
            console.error('Failed to initialize SMILES drawer:', err);
            setError('Invalid SMILES');
            setIsLoading(false);
        }
    }, [smiles, width, height]);

    if (error) return <span className="text-destructive font-mono text-sm">{error}: {smiles}</span>;

    return (
        <div className={`inline-block ${className || ''}`}>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="max-w-full h-auto"
                data-testid="smiles-canvas"
                style={{ opacity: isLoading ? 0.5 : 1 }}
            />
        </div>
    );
}
