// /js/views/imagePrep.js
//
// Client-side image preparation for the photo-match prototype.
//
// What it does, in order:
//   1. Decodes the file to a bitmap, respecting EXIF orientation so portrait
//      photos taken on a phone aren't sent sideways.
//   2. Resizes so the longest side is at most 1500px (skips smaller images).
//   3. Re-encodes through a 2D canvas as JPEG at 0.85 quality. This drop is
//      what strips EXIF — canvas re-encoding never carries metadata across.
//   4. Returns { base64, mediaType, dataUrl } in the shape photoMatch.js
//      already expects.
//
// HEIC: createImageBitmap can decode HEIC on Safari but typically not on
// Chrome/Firefox. We try createImageBitmap first, fall back to a plain
// HTMLImageElement, and surface a clear error if neither works.

(function () {
  const MAX_LONGEST_SIDE = 1500;
  const JPEG_QUALITY = 0.85;
  const OUTPUT_TYPE = 'image/jpeg';

  async function process(file) {
    if (!file) throw new Error('No file selected.');

    const bitmap = await decode(file);
    try {
      const { width, height } = targetSize(bitmap.width, bitmap.height, MAX_LONGEST_SIDE);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      // White fill in case the source has transparency — JPEG can't carry alpha.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, OUTPUT_TYPE, JPEG_QUALITY);
      const dataUrl = await blobToDataUrl(blob);
      const idx = dataUrl.indexOf('base64,');
      if (idx < 0) throw new Error('Image encoding failed.');
      return {
        base64: dataUrl.slice(idx + 'base64,'.length),
        mediaType: blob.type || OUTPUT_TYPE,
        dataUrl,
      };
    } finally {
      if (typeof bitmap.close === 'function') bitmap.close();
    }
  }

  async function decode(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (_) {
        // fall through to HTMLImageElement path
      }
    }
    return decodeViaImageElement(file);
  }

  function decodeViaImageElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('That image format is not supported by this browser. Try a JPG or PNG.'));
      };
      img.src = url;
    });
  }

  function targetSize(srcW, srcH, maxLongest) {
    const longest = Math.max(srcW, srcH);
    if (longest <= maxLongest) return { width: srcW, height: srcH };
    const scale = maxLongest / longest;
    return {
      width: Math.max(1, Math.round(srcW * scale)),
      height: Math.max(1, Math.round(srcH * scale)),
    };
  }

  function canvasToBlob(canvas, mediaType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas could not encode the image.')),
        mediaType,
        quality
      );
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('Could not read the encoded image.'));
      r.readAsDataURL(blob);
    });
  }

  window.RG = window.RG || {};
  window.RG.imagePrep = { process };
})();
