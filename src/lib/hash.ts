import sharp from "sharp";

// get the average hash of an image and return as bigint
export async function aHashFromUrl(url: string, timeoutMs = 20000): Promise<bigint | null> {
  const raw = await fetchBytes(url, timeoutMs); //raw bytes
  if (!raw) return null;

  try {
    const img = sharp(raw, {failOn: "none" })
      .flatten({ background: "#fff" })
      .resize(8, 8, { fit: "fill" })
      .grayscale()
      .raw();

    const {data } = await img.toBuffer({ resolveWithObject: true });
    if (data.length !== 64) return null;

    let sum = 0;
    for (const v of data) sum += v;
    const avg = sum / 64;

    let bits = 0n;
    for (let i = 0; i < 64; i++) {
      if (data[i] >= avg) bits |= 1n << BigInt(63 - i);
    }

    return bits;
  } catch {
    return null;
  }
}

//hamming distance between two bigints
export function hamming(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  
  while (x) { 
    x &= x - 1n; count++; 
  }

  return count;
}

//fetch raw image bytes, with a tie out inplace
async function fetchBytes(url: string, timeout: number): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const time = setTimeout(() => ctrl.abort(), timeout);

  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });

    if (!res.ok) { return null; }
    const arr = await res.arrayBuffer();

    return Buffer.from(arr);
  } catch {
    return null;
  } finally {
    clearTimeout(time);
  }
}
