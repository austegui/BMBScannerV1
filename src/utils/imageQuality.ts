export interface BlurResult {
  isBlurry: boolean;
  variance: number;  // Higher = sharper, lower = blurrier
}

export interface DarknessResult {
  isDark: boolean;
  brightness: number;  // 0-255, higher = brighter
}

/**
 * Detects blur in an image using Laplacian variance edge detection.
 * Images are scaled down to max 500px for performance.
 *
 * @param file - The image file to analyze
 * @returns BlurResult with isBlurry flag and variance value
 */
export async function detectBlur(file: File): Promise<BlurResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Scale down for performance (max 500px on longest side)
        const maxDimension = 500;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        // Create canvas and draw scaled image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;

        // Convert to grayscale and store in array
        const grayscale: number[] = [];
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          // Standard grayscale conversion
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          grayscale.push(gray);
        }

        // Apply Laplacian operator (edge detection kernel)
        // Kernel: [0, 1, 0]
        //         [1,-4, 1]
        //         [0, 1, 0]
        const laplacianValues: number[] = [];

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const top = grayscale[(y - 1) * width + x];
            const bottom = grayscale[(y + 1) * width + x];
            const left = grayscale[y * width + (x - 1)];
            const right = grayscale[y * width + (x + 1)];
            const center = grayscale[idx];

            // Apply Laplacian kernel
            const laplacian = top + bottom + left + right - 4 * center;
            laplacianValues.push(laplacian);
          }
        }

        // Calculate variance of Laplacian values
        const mean = laplacianValues.reduce((sum, val) => sum + val, 0) / laplacianValues.length;
        const squaredDiffs = laplacianValues.map(val => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;

        // Clean up
        URL.revokeObjectURL(objectUrl);

        // Threshold: variance < 100 indicates blur (conservative starting point)
        const isBlurry = variance < 100;

        resolve({ isBlurry, variance });
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

/**
 * Detects darkness in an image using average luminance calculation.
 * Images are scaled down to max 500px for performance.
 *
 * @param file - The image file to analyze
 * @returns DarknessResult with isDark flag and brightness value (0-255)
 */
export async function detectDarkness(file: File): Promise<DarknessResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Scale down for performance (max 500px on longest side)
        const maxDimension = 500;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        // Create canvas and draw scaled image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;

        // Calculate average brightness using luminance formula
        let totalBrightness = 0;
        const pixelCount = pixels.length / 4;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          // Luminance formula (perceived brightness)
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          totalBrightness += brightness;
        }

        const avgBrightness = totalBrightness / pixelCount;

        // Clean up
        URL.revokeObjectURL(objectUrl);

        // Threshold: brightness < 80 indicates too dark (0-255 scale)
        const isDark = avgBrightness < 80;

        resolve({ isDark, brightness: avgBrightness });
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}
