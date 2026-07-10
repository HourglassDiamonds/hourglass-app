/**
 * Download a signed capture URL and adopt it as a local object URL.
 * Acknowledgement must only run after this succeeds.
 */
export async function adoptRemoteCaptureImage(imageUrl: string): Promise<{
  objectUrl: string;
  mime: string;
  byteLength: number;
}> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error("download_failed");
  }

  const blob = await res.blob();
  if (blob.size < 32) {
    throw new Error("invalid_image");
  }

  const mime = (blob.type || "").toLowerCase();
  const looksLikeImage =
    mime.startsWith("image/") ||
    mime === "application/octet-stream" ||
    mime === "";

  if (!looksLikeImage) {
    throw new Error("invalid_image");
  }

  return {
    objectUrl: URL.createObjectURL(blob),
    mime: mime.startsWith("image/") ? mime : "image/jpeg",
    byteLength: blob.size,
  };
}
