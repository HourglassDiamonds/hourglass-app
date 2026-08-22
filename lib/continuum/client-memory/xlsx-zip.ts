/**
 * Minimal ZIP reader/writer for XLSX (store + deflate).
 * Not a general-purpose archive library.
 */

import { inflateRawSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

function u32(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset] |
      (buf[offset + 1] << 8) |
      (buf[offset + 2] << 16) |
      (buf[offset + 3] << 24)) >>>
    0
  );
}

function writeU16(buf: Buffer, offset: number, value: number): void {
  buf.writeUInt16LE(value, offset);
}

function writeU32(buf: Buffer, offset: number, value: number): void {
  buf.writeUInt32LE(value, offset);
}

export function unzipToMap(buffer: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (
      buffer[i] === 0x50 &&
      buffer[i + 1] === 0x4b &&
      buffer[i + 2] === 0x05 &&
      buffer[i + 3] === 0x06
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("xlsx: missing ZIP end-of-central-directory");
  const cdOffset = u32(buffer, eocd + 16);
  const cdEntries = u16(buffer, eocd + 10);
  let offset = cdOffset;
  for (let n = 0; n < cdEntries; n += 1) {
    if (u32(buffer, offset) !== 0x02014b50) {
      throw new Error("xlsx: corrupt ZIP central directory");
    }
    const method = u16(buffer, offset + 10);
    const compressedSize = u32(buffer, offset + 20);
    const nameLen = u16(buffer, offset + 28);
    const extraLen = u16(buffer, offset + 30);
    const commentLen = u16(buffer, offset + 32);
    const localOffset = u32(buffer, offset + 42);
    const name = new TextDecoder().decode(
      buffer.slice(offset + 46, offset + 46 + nameLen),
    );
    const localNameLen = u16(buffer, localOffset + 26);
    const localExtraLen = u16(buffer, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    let uncompressed: Uint8Array;
    if (method === 0) {
      uncompressed = compressed;
    } else if (method === 8) {
      uncompressed = inflateRawSync(compressed);
    } else {
      throw new Error(`xlsx: unsupported ZIP method ${method}`);
    }
    files.set(name.replace(/\\/g, "/"), uncompressed);
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

export function zipFromFiles(files: Record<string, string | Uint8Array>): Buffer {
  const entries = Object.entries(files).map(([name, body]) => {
    const data = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);
    return { name: name.replace(/\\/g, "/"), data, crc: crc32(data) };
  });
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const local = Buffer.alloc(30 + nameBuf.length + entry.data.length);
    writeU32(local, 0, 0x04034b50);
    writeU16(local, 4, 20);
    writeU16(local, 6, 0);
    writeU16(local, 8, 0);
    writeU16(local, 10, 0);
    writeU16(local, 12, 0);
    writeU32(local, 14, entry.crc);
    writeU32(local, 18, entry.data.length);
    writeU32(local, 22, entry.data.length);
    writeU16(local, 26, nameBuf.length);
    writeU16(local, 28, 0);
    nameBuf.copy(local, 30);
    entry.data.copy(local, 30 + nameBuf.length);
    locals.push(local);

    const central = Buffer.alloc(46 + nameBuf.length);
    writeU32(central, 0, 0x02014b50);
    writeU16(central, 4, 20);
    writeU16(central, 6, 20);
    writeU16(central, 8, 0);
    writeU16(central, 10, 0);
    writeU16(central, 12, 0);
    writeU16(central, 14, 0);
    writeU32(central, 16, entry.crc);
    writeU32(central, 20, entry.data.length);
    writeU32(central, 24, entry.data.length);
    writeU16(central, 28, nameBuf.length);
    writeU16(central, 30, 0);
    writeU16(central, 32, 0);
    writeU16(central, 34, 0);
    writeU16(central, 36, 0);
    writeU32(central, 38, 0);
    writeU32(central, 42, offset);
    nameBuf.copy(central, 46);
    centrals.push(central);
    offset += local.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  writeU32(eocd, 0, 0x06054b50);
  writeU16(eocd, 4, 0);
  writeU16(eocd, 6, 0);
  writeU16(eocd, 8, entries.length);
  writeU16(eocd, 10, entries.length);
  writeU32(eocd, 12, cd.length);
  writeU32(eocd, 16, offset);
  writeU16(eocd, 20, 0);
  return Buffer.concat([...locals, cd, eocd]);
}
