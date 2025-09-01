# Watermark App

A simple and intuitive online tool for adding watermarks to your documents and images. This application allows users to upload files, customize watermark text, font size, color, opacity, angle, and position, and then preview and download the watermarked output.

## Features

- **File Upload:** Easily upload multiple PDF and image files.
- **Customizable Watermarks:**
    - **Text:** Define your custom watermark text.
    - **Font Size & Color:** Adjust the appearance of your watermark.
    - **Opacity & Angle:** Control the visibility and rotation.
    - **Positioning:** Choose from various predefined positions (e.g., top-left, middle-center, bottom-right) or repeating patterns.
- **Live Preview:** See your watermark applied in real-time.
- **Batch Processing:** Apply watermarks to multiple files simultaneously.
- **Download:** Download the watermarked files.

## Technologies Used

- React
- TypeScript
- Bootstrap (for styling)
- pdf-lib (for PDF manipulation)
- jszip (for downloading multiple files)
- pdfjs-dist (for PDF rendering in preview)

## Getting Started

### Prerequisites

Make sure you have Node.js and npm (or yarn) installed.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/wayne0926/watermark.git
   cd watermark-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

To run the application in development mode:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### Building for Production

To build the application for production:

```bash
npm run build
```

This will create a `build` folder with optimized static files ready for deployment.

## Deployment

The `build` folder contains all the necessary static assets. You can deploy this folder to any static file hosting service or web server (e.g., Nginx, Apache, Netlify, Vercel).

## Contributing

Feel free to fork the repository, open issues, and submit pull requests.

## License

[Specify your license here, e.g., MIT License]