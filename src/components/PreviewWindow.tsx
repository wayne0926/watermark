import React, { useRef, useEffect, useState } from 'react';
import { WatermarkOptions, WatermarkPosition, ViewMode } from '../App';
import * as pdfjsLib from 'pdfjs-dist';
import { RenderTask, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { Thumbnail } from './Thumbnail';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

interface PreviewWindowProps {
  files: File[];
  options: WatermarkOptions;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
}

const hexToRgba = (hex: string, opacity: number) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`
    : `rgba(0, 0, 0, ${opacity})`;
};

const getWatermarkPosition = (
    position: WatermarkPosition,
    canvasWidth: number,
    canvasHeight: number,
    margin: number
): { x: number; y: number; textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline } => {
    const positions: { [key in WatermarkPosition]: { x: number; y: number; textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline } } = {
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
    return positions[position] || positions['middle-center'];
};

const drawWatermark = (ctx: CanvasRenderingContext2D, options: WatermarkOptions) => {
    const { width, height } = ctx.canvas;
    const { text, fontSize, color, opacity, angle, mode, position, rowSpacing, colSpacing } = options;
    
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
        const textHeight = fontSize; // Using fontSize as an approximation for height

        const hSpacing = textWidth + colSpacing;
        const vSpacing = textHeight + rowSpacing;
        
        const rad = -angle * Math.PI / 180;

        for (let y = 0; y < height + vSpacing; y += vSpacing) {
            for (let x = 0; x < width + hSpacing; x += hSpacing) {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(rad);
                ctx.fillText(text, 0, 0);
                ctx.restore();
            }
        }
        ctx.restore();
    }
}

export const PreviewWindow: React.FC<PreviewWindowProps> = ({
  files,
  options,
  viewMode,
  setViewMode,
  selectedIndex,
  setSelectedIndex,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);

  const isPdfMode = files.length === 1 && files[0]?.type === 'application/pdf';
  const fileToRender = isPdfMode ? files[0] : files[selectedIndex];

  useEffect(() => {
    if (isPdfMode) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (!e.target?.result) return;
        try {
            const pdfData = new Uint8Array(e.target.result as ArrayBuffer);
            const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
            setPdfDoc(doc);
            if (doc.numPages > 1) {
                setViewMode('overview');
            }
        } catch (error) {
            console.error("Failed to load PDF document:", error);
            setPdfDoc(null);
        }
      };
      reader.readAsArrayBuffer(files[0]);
    } else {
      setPdfDoc(null);
    }
  }, [files, isPdfMode, setViewMode]);

  useEffect(() => {
    if (viewMode !== 'detail' || !canvasRef.current || !fileToRender) return;

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

    if (!isPdfMode && fileToRender) { // Image rendering
      const imageUrl = URL.createObjectURL(fileToRender);
      const img = new Image();
      img.onload = () => {
        const parentWidth = visibleCanvas.parentElement?.clientWidth || 600;
        const scale = Math.min(parentWidth / img.width, 1);
        offscreenCanvas.width = img.width * scale;
        offscreenCanvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
        drawWatermark(ctx, options);
        drawToVisibleCanvas();
        URL.revokeObjectURL(imageUrl);
      };
      img.onerror = () => { URL.revokeObjectURL(imageUrl); };
      img.src = imageUrl;
    } else if (isPdfMode && pdfDoc) { // PDF page rendering
        (async () => {
            try {
                const page = await pdfDoc.getPage(selectedIndex + 1);
                const parentWidth = visibleCanvas.parentElement?.clientWidth || 600;
                const viewport = page.getViewport({ scale: 1 });
                const scale = parentWidth / viewport.width;
                const scaledViewport = page.getViewport({ scale });

                offscreenCanvas.width = scaledViewport.width;
                offscreenCanvas.height = scaledViewport.height;

                const renderContext = { canvasContext: ctx, viewport: scaledViewport };
                renderTaskRef.current = page.render(renderContext as any);
                
                await renderTaskRef.current.promise;
                drawWatermark(ctx, options);
                drawToVisibleCanvas();
            } catch (error: any) {
                if (error.name !== 'RenderingCancelledException') {
                    console.error("PDF detail rendering error:", error);
                }
            }
        })();
    }

    return () => {
        if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
        }
    }

  }, [fileToRender, options, viewMode, selectedIndex, isPdfMode, pdfDoc]);

  const handleThumbnailClick = (index: number) => {
    setSelectedIndex(index);
    setViewMode('detail');
  };

  const renderOverview = () => (
    <div className="d-flex flex-wrap justify-content-center p-2" style={{ background: '#f8f9fa', maxHeight: '500px', overflowY: 'auto' }}>
      {!isPdfMode && files.map((file, index) => (
        <Thumbnail
          key={`file-${index}`}
          file={file}
          options={options}
          onClick={() => handleThumbnailClick(index)}
          isActive={index === selectedIndex}
        />
      ))}
      {isPdfMode && pdfDoc && Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1).map(pageNumber => (
        <Thumbnail
          key={`page-${pageNumber}`}
          pdfDoc={pdfDoc}
          pageNumber={pageNumber}
          options={options}
          onClick={() => handleThumbnailClick(pageNumber - 1)}
          isActive={pageNumber - 1 === selectedIndex}
        />
      ))}
    </div>
  );

  const renderDetailView = () => (
    <>
      {(files.length > 1 || (pdfDoc && pdfDoc.numPages > 1)) && (
        <button className="btn btn-secondary btn-sm mb-2" onClick={() => setViewMode('overview')}>
          &larr; Back to Overview
        </button>
      )}
      <div style={{ width: '100%', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {fileToRender ? <canvas ref={canvasRef} /> : <p>No file selected.</p>}
      </div>
    </>
  );

  return (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title">
          {viewMode === 'overview' ? `Overview (${!isPdfMode ? files.length + ' files' : (pdfDoc?.numPages || 0) + ' pages'})` : `Preview (${selectedIndex + 1})`}
        </h5>
        {files.length === 0 ? (
          <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p>Upload a file to see the preview</p>
          </div>
        ) : viewMode === 'overview' ? (
          renderOverview()
        ) : (
          renderDetailView()
        )}
      </div>
    </div>
  );
};
