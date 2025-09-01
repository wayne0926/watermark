import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { FileUploader } from './FileUploader';
import { WatermarkOptions, WatermarkPosition } from '../App';
import './SettingsPanel.css';

// Helper functions...
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

const getWatermarkPositionPdf = (
    position: WatermarkPosition,
    pageWidth: number,
    pageHeight: number,
    margin: number
): { x: number; y: number } => {
    const positions = {
        'top-left': { x: margin, y: pageHeight - margin },
        'top-center': { x: pageWidth / 2, y: pageHeight - margin },
        'top-right': { x: pageWidth - margin, y: pageHeight - margin },
        'middle-left': { x: margin, y: pageHeight / 2 },
        'middle-center': { x: pageWidth / 2, y: pageHeight / 2 },
        'middle-right': { x: pageWidth - margin, y: pageHeight / 2 },
        'bottom-left': { x: margin, y: margin },
        'bottom-center': { x: pageWidth / 2, y: margin },
        'bottom-right': { x: pageWidth - margin, y: margin },
    };
    return positions[position] || positions['middle-center'];
};

interface SavedStyle {
    name: string;
    options: WatermarkOptions;
}

interface SettingsPanelProps {
  options: WatermarkOptions;
  setOptions: (options: WatermarkOptions) => void;
  files: File[];
  setFiles: (files: File[]) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  options,
  setOptions,
  files,
  setFiles,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [styleName, setStyleName] = useState('');
  const [savedStyles, setSavedStyles] = useState<SavedStyle[]>([]);
  const [localOptions, setLocalOptions] = useState(options);

  useEffect(() => {
    const handler = setTimeout(() => {
      setOptions(localOptions);
    }, 200);

    return () => {
      clearTimeout(handler);
    };
  }, [localOptions, setOptions]);

  useEffect(() => {
    setLocalOptions(options);
  }, [options]);

  useEffect(() => {
    try {
        const stylesFromStorage = localStorage.getItem('watermarkStyles');
        if (stylesFromStorage) {
            setSavedStyles(JSON.parse(stylesFromStorage));
        }
    } catch (error) {
        console.error("Could not load styles from localStorage", error);
        localStorage.removeItem('watermarkStyles');
    }
  }, []);

  const handleSaveStyle = () => {
    if (!styleName.trim()) {
        alert('Please enter a name for the style.');
        return;
    }
    if (savedStyles.some(s => s.name === styleName.trim())) {
        alert('A style with this name already exists.');
        return;
    }
    const newStyle = { name: styleName.trim(), options: localOptions };
    const updatedStyles = [...savedStyles, newStyle];
    setSavedStyles(updatedStyles);
    localStorage.setItem('watermarkStyles', JSON.stringify(updatedStyles));
    setStyleName('');
  };

  const applyStyle = (style: SavedStyle) => {
    setOptions(style.options);
  };

  const deleteStyle = (styleNameToDelete: string) => {
    const updatedStyles = savedStyles.filter(s => s.name !== styleNameToDelete);
    setSavedStyles(updatedStyles);
    localStorage.setItem('watermarkStyles', JSON.stringify(updatedStyles));
  };

  const handleOptionChange = (field: keyof WatermarkOptions, value: any) => {
    setLocalOptions({ ...localOptions, [field]: value });
  };

  const drawWatermarkOnCanvas = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, customOptions: WatermarkOptions) => {
    const { text, fontSize, color, opacity, angle, mode, position, rowSpacing, colSpacing } = customOptions;
    
    ctx.fillStyle = hexToRgba(color, opacity);
    ctx.font = `${fontSize}px Arial`;

    if (mode === 'single') {
        const pos = getWatermarkPosition(position, canvasWidth, canvasHeight, fontSize);
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

        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        ctx.rotate(rad);
        ctx.translate(-canvasWidth / 2, -canvasHeight / 2);
        
        for (let y = 0; y < canvasHeight * 2; y += vSpacing) {
            for (let x = 0; x < canvasWidth * 2; x += hSpacing) {
                ctx.fillText(text, x - canvasWidth, y - canvasHeight);
            }
        }
        ctx.restore();
    }
  }

  const applyWatermarkToImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const imageUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));

        ctx.drawImage(img, 0, 0);
        
        const scaledFontSize = options.fontSize * (img.width / 1000);
        drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, { ...options, fontSize: scaledFontSize });

        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Canvas to Blob conversion failed'));
          resolve(blob);
        }, file.type);

        URL.revokeObjectURL(imageUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error('Image loading failed'));
      };
      img.src = imageUrl;
    });
  };

  const applyWatermarkToPdf = async (file: File): Promise<Blob> => {
    const existingPdfBytes = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    const { text, fontSize, color, opacity, angle, mode, position, rowSpacing, colSpacing } = options;

    const hex = color.slice(1);
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    for (const page of pages) {
        const { width, height } = page.getSize();
        const scaledFontSize = fontSize * (width / 1000);

        if (mode === 'single') {
            const pos = getWatermarkPositionPdf(position, width, height, scaledFontSize);
            const textWidth = helveticaFont.widthOfTextAtSize(text, scaledFontSize);
            
            let x = pos.x;
            if (position.includes('right')) x -= textWidth / 2;
            else if (position.includes('center')) x -= textWidth / 2;
            else x += textWidth / 2;

            page.drawText(text, {
                x: x,
                y: pos.y,
                font: helveticaFont,
                size: scaledFontSize,
                color: rgb(r, g, b),
                opacity: opacity,
                rotate: degrees(angle),
            });
        } else { // repeating
            const textWidth = helveticaFont.widthOfTextAtSize(text, scaledFontSize);
            const textHeight = scaledFontSize;

            const rad = angle * Math.PI / 180;
            const absCos = Math.abs(Math.cos(rad));
            const absSin = Math.abs(Math.sin(rad));
            const boxWidth = textWidth * absCos + textHeight * absSin;
            const boxHeight = textWidth * absSin + textHeight * absCos;

            const hSpacing = boxWidth + colSpacing;
            const vSpacing = boxHeight + rowSpacing;

            for (let y = 0; y < height + vSpacing; y += vSpacing) {
                for (let x = 0; x < width + hSpacing; x += hSpacing) {
                    page.drawText(text, {
                        x, y,
                        font: helveticaFont,
                        size: scaledFontSize,
                        color: rgb(r, g, b),
                        opacity: opacity,
                        rotate: degrees(angle),
                    });
                }
            }
        }
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  };

  const handleDownload = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    try {
        const firstFile = files[0];
        if (firstFile.type === 'application/pdf') {
            const blob = await applyWatermarkToPdf(firstFile);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `watermarked_${firstFile.name}`;
            link.click();
            URL.revokeObjectURL(link.href);
        } else {
            if (files.length === 1) {
                const blob = await applyWatermarkToImage(firstFile);
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `watermarked_${firstFile.name}`;
                link.click();
                URL.revokeObjectURL(link.href);
            } else {
                const zip = new JSZip();
                for (const imgFile of files) {
                    if(imgFile.type.startsWith('image/')) {
                        const blob = await applyWatermarkToImage(imgFile);
                        zip.file(`watermarked_${imgFile.name}`, blob);
                    }
                }
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(zipBlob);
                link.download = 'watermarked_images.zip';
                link.click();
                URL.revokeObjectURL(link.href);
            }
        }
    } catch (error) {
      console.error("Failed to process files:", error);
      alert("An error occurred while processing the files. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const positions: WatermarkPosition[] = [
    'top-left', 'top-center', 'top-right',
    'middle-left', 'middle-center', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right'
  ];

  return (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title">Controls</h5>
        <FileUploader setFiles={setFiles} files={files} />
        <hr />
        <div className="mb-3">
          <label htmlFor="watermarkText" className="form-label">Watermark Text</label>
          <input type="text" className="form-control" id="watermarkText" value={localOptions.text} onChange={(e) => handleOptionChange('text', e.target.value)} />
        </div>
        <div className="mb-3">
          <label htmlFor="fontSize" className="form-label">Font Size: {localOptions.fontSize}px</label>
          <input type="range" className="form-range" id="fontSize" min="10" max="128" step="1" value={localOptions.fontSize} onChange={(e) => handleOptionChange('fontSize', parseInt(e.target.value, 10))} />
        </div>
        <div className="mb-3">
          <label htmlFor="opacity" className="form-label">Opacity: {localOptions.opacity}</label>
          <input type="range" className="form-range" id="opacity" min="0" max="1" step="0.1" value={localOptions.opacity} onChange={(e) => handleOptionChange('opacity', parseFloat(e.target.value))} />
        </div>
        <div className="mb-3">
          <label htmlFor="angle" className="form-label">Angle: {localOptions.angle}°</label>
          <input type="range" className="form-range" id="angle" min="-180" max="180" step="1" value={localOptions.angle} onChange={(e) => handleOptionChange('angle', parseInt(e.target.value, 10))} />
        </div>
        <div className="mb-3">
            <label htmlFor="color" className="form-label">Color</label>
            <input type="color" className="form-control form-control-color" id="color" value={localOptions.color} title="Choose your color" onChange={(e) => handleOptionChange('color', e.target.value)} />
        </div>
        <div className="mb-3">
            <label className="form-label">Mode</label>
            <div className="btn-group w-100">
                <input type="radio" className="btn-check" name="mode" id="mode-single" autoComplete="off" checked={localOptions.mode === 'single'} onChange={() => handleOptionChange('mode', 'single')} />
                <label className="btn btn-outline-secondary" htmlFor="mode-single">Single</label>
                <input type="radio" className="btn-check" name="mode" id="mode-repeating" autoComplete="off" checked={localOptions.mode === 'repeating'} onChange={() => handleOptionChange('mode', 'repeating')} />
                <label className="btn btn-outline-secondary" htmlFor="mode-repeating">Repeating</label>
            </div>
        </div>

        {localOptions.mode === 'single' ? (
            <div className="mb-3">
                <label className="form-label">Position</label>
                <div className="position-grid">
                    {positions.map(pos => (
                        <button 
                            key={pos} 
                            className={`btn ${localOptions.position === pos ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => handleOptionChange('position', pos)}
                        />
                    ))}
                </div>
            </div>
        ) : (
            <>
                <div className="mb-3">
                    <label htmlFor="rowSpacing" className="form-label">Row Spacing: {localOptions.rowSpacing}px</label>
                    <input type="range" className="form-range" id="rowSpacing" min="0" max="500" step="10" value={localOptions.rowSpacing} onChange={(e) => handleOptionChange('rowSpacing', parseInt(e.target.value, 10))} />
                </div>
                <div className="mb-3">
                    <label htmlFor="colSpacing" className="form-label">Column Spacing: {localOptions.colSpacing}px</label>
                    <input type="range" className="form-range" id="colSpacing" min="0" max="500" step="10" value={localOptions.colSpacing} onChange={(e) => handleOptionChange('colSpacing', parseInt(e.target.value, 10))} />
                </div>
            </>
        )}
        
        <hr />
        <div className="mt-4">
            <h5>Manage Styles</h5>
            <div className="input-group mb-3">
                <input 
                    type="text" 
                    className="form-control" 
                    placeholder="New style name" 
                    value={styleName}
                    onChange={(e) => setStyleName(e.target.value)}
                />
                <button className="btn btn-outline-success" type="button" onClick={handleSaveStyle}>Save</button>
            </div>
            {savedStyles.length > 0 && (
                <ul className="list-group">
                    {savedStyles.map(style => (
                        <li key={style.name} className="list-group-item d-flex justify-content-between align-items-center">
                            <button className="btn btn-link p-0 text-start" onClick={() => applyStyle(style)}>
                                {style.name}
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => deleteStyle(style.name)}>
                                &times;
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
        <hr />
        <button className="btn btn-primary w-100 mt-3" onClick={handleDownload} disabled={files.length === 0 || isProcessing}>
          {isProcessing ? 'Processing...' : `Download ${files.length} File(s)`}
        </button>
      </div>
    </div>
  );
};
