/**
 * End-to-end encryption utilities using Web Crypto API.
 * Files are encrypted with AES-GCM before upload and decrypted after download.
 * The server never sees plaintext file data.
 */

// Generate a random AES-GCM key
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

// Export key to base64 string for storage
export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

// Import key from base64 string
export async function importKey(keyBase64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt a Uint8Array chunk with AES-GCM
export async function encryptChunk(
  key: CryptoKey,
  chunk: Uint8Array
): Promise<{ iv: Uint8Array; data: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    chunk as unknown as ArrayBuffer
  );
  return { iv, data: new Uint8Array(encrypted) };
}

// Decrypt a file chunk with AES-GCM
export async function decryptChunk(
  key: CryptoKey,
  encryptedData: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encryptedData as unknown as ArrayBuffer
  );
  return new Uint8Array(decrypted);
}

/**
 * Encrypt an entire file, returning an array of packed chunks.
 * Each packed chunk: [12-byte IV][4-byte data length (big-endian)][encrypted data]
 */
export async function encryptFile(
  key: CryptoKey,
  file: Blob,
  chunkSize = 64 * 1024
): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = [];
  const totalChunks = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const slice = new Uint8Array(await file.slice(start, end).arrayBuffer());
    const { iv, data } = await encryptChunk(key, slice);

    // Pack: IV (12) + data length (4, big-endian) + encrypted data
    const packed = new Uint8Array(12 + 4 + data.length);
    packed.set(iv, 0);
    new DataView(packed.buffer, packed.byteOffset + 12, 4).setUint32(data.length, false as unknown as number);
    packed.set(data, 16);
    chunks.push(packed);
  }

  return chunks;
}

// Decrypt a single packed chunk back to plaintext
export async function decryptPackedChunk(
  key: CryptoKey,
  packed: Uint8Array
): Promise<Uint8Array> {
  const iv = packed.slice(0, 12);
  const dataLen = new DataView(packed.buffer, packed.byteOffset + 12, 4).getUint32(false as unknown as number);
  const data = packed.slice(16, 16 + dataLen);
  return decryptChunk(key, data, iv);
}
