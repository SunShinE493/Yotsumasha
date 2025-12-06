import React, { useEffect, useRef, useState } from 'react';
import * as SmiDrawerModule from '../lib/smiles-drawer-lib.js';
const SmiDrawer = (SmiDrawerModule as any).default || SmiDrawerModule;

interface SmilesTextProps {
    smiles: string;
    className?: string;
    width?: number;
    height?: number;
}

export function SmilesText({ smiles, className, width = 300, height = 200 }: SmilesTextProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!canvasRef.current || !smiles) return;

        try {
            // Initialize the drawer
            // Options can be customized: https://github.com/reymond-group/smilesDrawer
            const options = {
                width: width,
                height: height
            };
            const drawer = new SmiDrawer(options);

            // Draw the SMILES string
            drawer.draw(smiles, canvasRef.current, 'light', false);
            setError(null);
        } catch (err: any) {
            console.error('Failed to draw SMILES:', err);
            setError('Invalid SMILES');
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
            />
        </div>
    );
}
