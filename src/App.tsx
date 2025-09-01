import React, { useState, useEffect } from 'react';
import './App.css';
import { SettingsPanel } from './components/SettingsPanel';
import { PreviewWindow } from './components/PreviewWindow';

export type WatermarkMode = 'single' | 'repeating';
export type WatermarkPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'middle-center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type ViewMode = 'overview' | 'detail';

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  angle: number;
  mode: WatermarkMode;
  position: WatermarkPosition;
  rowSpacing: number;
  colSpacing: number;
}

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<WatermarkOptions>({
    text: 'Your Watermark',
    fontSize: 48,
    color: '#ffffff',
    opacity: 0.5,
    angle: 0,
    mode: 'single',
    position: 'middle-center',
    rowSpacing: 50,
    colSpacing: 50,
  });
  const [viewMode, setViewMode] = useState<ViewMode>('detail');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // When files change, reset the view
  useEffect(() => {
    setSelectedIndex(0);
    // Default to detail view for single file, overview for multiple
    if (files.length > 1) {
      setViewMode('overview');
    } else {
      setViewMode('detail');
    }
  }, [files]);

  return (
    <div className="App">
      <nav className="navbar navbar-dark bg-dark">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">Online Watermark Tool</span>
        </div>
      </nav>
      <main className="container mt-4">
        <div className="row">
          <div className="col-md-4">
            <SettingsPanel
              options={options}
              setOptions={setOptions}
              files={files}
              setFiles={setFiles}
            />
          </div>
          <div className="col-md-8">
            <PreviewWindow
              files={files}
              options={options}
              viewMode={viewMode}
              setViewMode={setViewMode}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
