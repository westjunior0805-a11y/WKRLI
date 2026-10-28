/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Compresses an image data URI to a max dimension and quality,
 * ensuring document sizes stay strictly within Firestore's 1MB limit (< 100KB).
 */
export async function compressBase64Image(
  dataUri: string,
  maxWidth = 480,
  maxHeight = 480,
  quality = 0.7
): Promise<string> {
  if (!dataUri || typeof dataUri !== 'string') {
    return '';
  }

  // Not a data URL (e.g. regular https:// URL)
  if (!dataUri.startsWith('data:image/')) {
    return dataUri;
  }

  // If already under 75KB, no need to re-encode
  if (dataUri.length < 75000) {
    return dataUri;
  }

  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.document) {
      resolve(dataUri);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let { width, height } = img;
        if (width <= 0 || height <= 0) {
          resolve(dataUri);
          return;
        }

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUri);
          return;
        }

        // Fill white background in case of transparent PNG converted to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (err) {
        console.warn('Image compression fallback:', err);
        resolve(dataUri);
      }
    };

    img.onerror = () => {
      resolve(dataUri);
    };

    img.src = dataUri;
  });
}

/**
 * Reads and compresses a File to a lightweight base64 JPEG string
 */
export async function compressImageFile(
  file: File,
  maxWidth = 480,
  maxHeight = 480,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawData = e.target?.result as string;
      if (!rawData) {
        resolve('');
        return;
      }
      try {
        const compressed = await compressBase64Image(rawData, maxWidth, maxHeight, quality);
        resolve(compressed);
      } catch {
        resolve(rawData);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
