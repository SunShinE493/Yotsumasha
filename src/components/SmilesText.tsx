import React, { useEffect, useRef, useState } from 'react';

declare global {
    interface Window {
        SmilesDrawer?: any;
    }
}

let smilesDrawerLoading: Promise<any> | null = null;

function ensureSmilesDrawer(): Promise<any> {
    if (window.SmilesDrawer) return Promise.resolve(window.SmilesDrawer);
    if (smilesDrawerLoading) return smilesDrawerLoading;
    
    smilesDrawerLoading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/smiles-drawer.min.js';
        script.async = true;
        script.onload = () => {
            const tryReady = () => {
                if (window.SmilesDrawer) {
                    resolve(window.SmilesDrawer);
                } else {
                    setTimeout(tryReady, 30);
                }
            };
            tryReady();
        };
        script.onerror = () => reject(new Error('Failed to load smiles-drawer'));
        document.head.appendChild(script);
    });
    return smilesDrawerLoading;
}

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
    const [libraryReady, setLibraryReady] = useState<boolean>(!!window.SmilesDrawer);

    useEffect(() => {
        if (!libraryReady) {
            ensureSmilesDrawer()
                .then(() => setLibraryReady(true))
                .catch((err) => {
                    console.error('Failed to load SmilesDrawer library:', err);
                    setError('Library load failed');
                    setIsLoading(false);
                });
        }
    }, [libraryReady]);

    useEffect(() => {
        if (!canvasRef.current || !smiles || !libraryReady || !window.SmilesDrawer) {
            if (libraryReady && !smiles) setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const SmilesDrawerLib = window.SmilesDrawer;
            const options = {
                width: width,
                height: height
            };
            
            const drawer = new SmilesDrawerLib.Drawer(options);

            SmilesDrawerLib.parse(
                smiles,
                (tree: any) => {
                    try {
                        if (canvasRef.current) {
                            drawer.draw(tree, canvasRef.current, 'light', false);
                        }
                        setError(null);
                    } catch (drawErr: any) {
                        console.error('Failed to draw SMILES:', drawErr);
                        setError('Invalid SMILES');
                    }
                    setIsLoading(false);
                },
                (parseErr: any) => {
                    console.error('Failed to parse SMILES:', parseErr);
                    setError('Invalid SMILES');
                    setIsLoading(false);
                }
            );
        } catch (err: any) {
            console.error('Failed to initialize SMILES drawer:', err);
            setError('Invalid SMILES');
            setIsLoading(false);
        }
    }, [smiles, width, height, libraryReady]);

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
