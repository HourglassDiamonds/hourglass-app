/** Minimal valid 24-bit BMP buffer for upload normalization tests. */
export async function createMinimalBmpBuffer(
  width = 32,
  height = 32,
): Promise<Buffer> {
  const { encode } = await import("bmp-js");
  const data = Buffer.alloc(width * height * 3, 180);
  return Buffer.from(encode({ data, width, height }).data);
}
