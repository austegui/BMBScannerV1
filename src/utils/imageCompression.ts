import imageCompression from 'browser-image-compression';

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
}

export async function compressImage(file: File): Promise<CompressionResult> {
  const options = {
    maxSizeMB: 1,              // Target: under 1MB
    maxWidthOrHeight: 1920,    // Reasonable mobile resolution
    useWebWorker: true,        // Non-blocking compression
    initialQuality: 0.8        // Start quality (library iterates down if needed)
  };

  const originalSize = file.size;
  const compressedFile = await imageCompression(file, options);

  return {
    file: compressedFile,
    originalSize,
    compressedSize: compressedFile.size
  };
}
