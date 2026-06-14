/**
 * Downscale a user-picked image to a small JPEG before upload. Phone photos are
 * commonly 3–10 MB; the person card only ever shows an 80px avatar, so a ~512px
 * JPEG keeps Storage tiny and loads fast on venue wifi.
 *
 * Browser/DOM-only (Image + canvas) — kept out of the Firebase I/O layer.
 */
export async function resizeImageToJpeg(
  file: File,
  maxDim = 512,
  quality = 0.8,
): Promise<Blob> {
  const bitmap = await loadImage(file);
  const { width, height } = bitmap;
  if (!width || !height) {
    throw new Error("Couldn't read that photo — try a different image");
  }
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context");
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap) bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Could not encode the image");
  return blob;
}

/**
 * Decode a File into something drawable. Prefer createImageBitmap, but fall back
 * to an <img> element if it's missing OR rejects (some browsers/formats reject
 * createImageBitmap yet still decode via <img>).
 */
async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to the <img> decoder
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Couldn't read that photo — try a different image"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
