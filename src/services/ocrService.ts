import { RawOCRResult } from '../types/receipt';

/**
 * OCR Service for extracting text from images using Google Cloud Vision API
 *
 * Much higher accuracy than client-side Tesseract.js, especially for receipts.
 */

const API_KEY = import.meta.env.VITE_GOOGLE_CLOUD_VISION_API_KEY;
const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;

/**
 * Convert a File to base64 string
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Initialize OCR (no-op for Cloud Vision, kept for API compatibility)
 */
export async function initOCR(): Promise<void> {
  console.log('[OCR] Using Google Cloud Vision API');
}

/**
 * Terminate OCR (no-op for Cloud Vision, kept for API compatibility)
 */
export async function terminateOCR(): Promise<void> {
  console.log('[OCR] Cloud Vision API - no cleanup needed');
}

/**
 * Extract text from an image file using Google Cloud Vision API
 *
 * @param imageFile - The image file to process
 * @param onProgress - Optional callback for progress updates (0-100)
 * @returns Raw OCR result with text and confidence
 */
export async function extractText(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<RawOCRResult> {
  if (!API_KEY) {
    throw new Error('Google Cloud Vision API key not configured. Set VITE_GOOGLE_CLOUD_VISION_API_KEY in .env');
  }

  console.log(`[OCR] Processing image: ${imageFile.name} (${(imageFile.size / 1024).toFixed(1)}KB)`);
  const startTime = performance.now();

  // Show progress: Converting to base64
  onProgress?.(10);

  try {
    // Convert image to base64
    const base64Image = await fileToBase64(imageFile);
    onProgress?.(30);

    // Prepare Cloud Vision API request
    const requestBody = {
      requests: [
        {
          image: {
            content: base64Image,
          },
          features: [
            {
              type: 'TEXT_DETECTION',
              maxResults: 1,
            },
          ],
        },
      ],
    };

    onProgress?.(50);

    // Call Cloud Vision API
    const response = await fetch(VISION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    onProgress?.(80);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Vision API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    onProgress?.(100);

    const duration = performance.now() - startTime;
    console.log(`[OCR] Extraction completed in ${duration.toFixed(0)}ms`);

    // Extract text from response
    const textAnnotations = data.responses?.[0]?.textAnnotations;

    if (!textAnnotations || textAnnotations.length === 0) {
      console.log('[OCR] No text detected in image');
      return {
        text: '',
        confidence: 0,
        words: [],
      };
    }

    // First annotation contains the full text
    const fullText = textAnnotations[0].description || '';

    // Remaining annotations are individual words with bounding boxes
    const words = textAnnotations.slice(1).map((annotation: { description: string; boundingPoly?: { vertices: Array<{ x?: number; y?: number }> } }) => ({
      text: annotation.description,
      confidence: 95, // Cloud Vision doesn't return per-word confidence, assume high
      bbox: annotation.boundingPoly?.vertices ? {
        x0: annotation.boundingPoly.vertices[0]?.x || 0,
        y0: annotation.boundingPoly.vertices[0]?.y || 0,
        x1: annotation.boundingPoly.vertices[2]?.x || 0,
        y1: annotation.boundingPoly.vertices[2]?.y || 0,
      } : { x0: 0, y0: 0, x1: 0, y1: 0 },
    }));

    console.log(`[OCR] Extracted ${words.length} words`);
    console.log('[OCR] Full text:', fullText.substring(0, 200) + (fullText.length > 200 ? '...' : ''));

    return {
      text: fullText,
      confidence: 95, // Cloud Vision typically has ~95% accuracy
      words,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    console.error(`[OCR] Extraction failed after ${duration.toFixed(0)}ms:`, error);
    throw new Error(`OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
