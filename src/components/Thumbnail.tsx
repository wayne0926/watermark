import React, { useRef, useEffect } from 'react';
import { WatermarkOptions, WatermarkPosition } from '../App';
import * as pdfjsLib from 'pdfjs-dist';
import { RenderTask, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

interface ThumbnailProps {
  file?: File; // For images
  pdfDoc?: PDFDocumentProxy; // For PDFs
  pageNumber?: number;
  options: WatermarkOptions;
  onClick: () => void;
  isActive: boolean;
}

const hexToRgba = (hex: string, opacity: number) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})` : `rgba(0, 0, 0, ${opacity})`;
};

const getWatermarkPosition = (
    position: WatermarkPosition,
    canvasWidth: number,
    canvasHeight: number,
    margin: number
): { x: number; y: number; textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline } => {
    const positions: { [key in WatermarkPosition]?: { x: number; y: number; textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline } } = {
        'top-left': { x: margin, y: margin, textAlign: 'left', textBaseline: 'top' },
        'top-center': { x: canvasWidth / 2, y: margin, textAlign: 'center', textBaseline: 'top' },
        'top-right': { x: canvasWidth - margin, y: margin, textAlign: 'right', textBaseline: 'top' },
        'middle-left': { x: margin, y: canvasHeight / 2, textAlign: 'left', textBaseline: 'middle' },
        'middle-center': { x: canvasWidth / 2, y: canvasHeight / 2, textAlign: 'center', textBaseline: 'middle' },
        'middle-right': { x: canvasWidth - margin, y: canvasHeight / 2, textAlign: 'right', textBaseline: 'middle' },
        'bottom-left': { x: margin, y: canvasHeight - margin, textAlign: 'left', textBaseline: 'bottom' },
        'bottom-center': { x: canvasWidth / 2, y: canvasHeight - margin, textAlign: 'center', textBaseline: 'bottom' },
        'bottom-right': { x: canvasWidth - margin, y: canvasHeight - margin, textAlign: 'right', textBaseline: 'bottom' },
    };
    return positions[position] || { x: canvasWidth / 2, y: canvasHeight / 2, textAlign: 'center', textBaseline: 'middle' };
};

const drawWatermarkToCanvas = (ctx: CanvasRenderingContext2D, options: WatermarkOptions, text: string) => {
    const { width, height } = ctx.canvas;
    const { color, opacity, angle, mode, position } = options;

    // Scale down options for the small thumbnail size
    const scaleFactor = 1 / 4;
    const fontSize = Math.max(8, options.fontSize * scaleFactor);
    const rowSpacing = options.rowSpacing * scaleFactor;
    const colSpacing = options.colSpacing * scaleFactor;

    ctx.fillStyle = hexToRgba(color, opacity);
    ctx.font = `${fontSize}px Arial`;

    if (mode === 'single') {
        const pos = getWatermarkPosition(position, width, height, fontSize);
        ctx.textAlign = pos.textAlign;
        ctx.textBaseline = pos.textBaseline;

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(-angle * Math.PI / 180); // Negative for counter-clockwise
        ctx.fillText(text, 0, 0);
        ctx.restore();
    } else { // repeating
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = fontSize; 

        const rad = -angle * Math.PI / 180; // Negative for counter-clockwise
        const absCos = Math.abs(Math.cos(rad));
        const absSin = Math.abs(Math.sin(rad));
        const boxWidth = textWidth * absCos + textHeight * absSin;
        const boxHeight = textWidth * absSin + textHeight * absCos;

        const hSpacing = boxWidth + colSpacing;
        const vSpacing = boxHeight + rowSpacing;

        ctx.translate(width / 2, height / 2);
        ctx.rotate(rad);
        ctx.translate(-width / 2, -height / 2);
        
        for (let y = 0; y < height * 2; y += vSpacing) {
            for (let x = 0; x < width * 2; x += hSpacing) {
                ctx.fillText(text, x - width, y - height);
            }
        }
        ctx.restore();
    }
};

export const Thumbnail: React.FC<ThumbnailProps> = ({ file, pdfDoc, pageNumber = 1, options, onClick, isActive }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderTaskRef = useRef<RenderTask | null>(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        const visibleCanvas = canvasRef.current;
        const visibleCtx = visibleCanvas.getContext('2d');
        if (!visibleCtx) return;

        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
        }

        const offscreenCanvas = document.createElement('canvas');
        const ctx = offscreenCanvas.getContext('2d');
        if (!ctx) return;

        const drawToVisibleCanvas = () => {
            visibleCanvas.width = offscreenCanvas.width;
            visibleCanvas.height = offscreenCanvas.height;
            visibleCtx.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
            visibleCtx.drawImage(offscreenCanvas, 0, 0);
        }

        if (file) { // Image rendering
            const imageUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                offscreenCanvas.width = 150;
                offscreenCanvas.height = 150;
                ctx.drawImage(img, 0, 0, 150, 150);
                drawWatermarkToCanvas(ctx, options, options.text);
                drawToVisibleCanvas();
                URL.revokeObjectURL(imageUrl);
            };
            img.src = imageUrl;
        } else if (pdfDoc) { // PDF rendering
            (async () => {
                try {
                    const page = await pdfDoc.getPage(pageNumber);
                    const viewport = page.getViewport({ scale: 1 });
                    const scale = Math.min(150 / viewport.width, 150 / viewport.height);
                    const scaledViewport = page.getViewport({ scale });
                    
                    offscreenCanvas.width = scaledViewport.width;
                    offscreenCanvas.height = scaledViewport.height;

                    const renderContext = { canvasContext: ctx, viewport: scaledViewport };
                    
                    renderTaskRef.current = page.render(renderContext as any);
                    await renderTaskRef.current.promise;
                    drawWatermarkToCanvas(ctx, options, `Page ${pageNumber}`);
                    drawToVisibleCanvas();
                } catch (error: any) {
                    if (error.name !== 'RenderingCancelledException') {
                        console.error(`Thumbnail rendering error for page ${pageNumber}:`, error);
                    }
                }
            })();
        }

        return () => {
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        }
    }, [file, pdfDoc, pageNumber, options]);

    const activeClass = isActive ? 'border-primary' : 'border-light';

    return (
        <div className="m-1" onClick={onClick} style={{ cursor: 'pointer' }}>
            <canvas ref={canvasRef} className={`border ${activeClass}`} style={{ width: 'auto', height: '150px' }} />
        </div>
    );
};