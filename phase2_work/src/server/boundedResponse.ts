/** Read a fetch body with a hard cap on bytes delivered by the decoded stream.
 * Content-Length is only an early rejection hint; it never establishes safety.
 * Retained payload storage is bounded to maxBytes, independent of chunk count.
 */
export async function readBoundedResponse(response: Response, maxBytes: number, sizeError = 'upstream_response_too_large'): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new RangeError('Invalid response byte limit');
  const announced = response.headers.get('content-length');
  if (announced !== null && /^\d+$/.test(announced.trim()) && Number(announced) > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new Error(sizeError);
  }
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  let buffer: Uint8Array | undefined;
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return buffer?.subarray(0, length) ?? new Uint8Array(0);
      if (value.byteLength > maxBytes - length) throw new Error(sizeError);
      if (value.byteLength === 0) continue;
      buffer ??= new Uint8Array(maxBytes);
      buffer.set(value, length);
      length += value.byteLength;
    }
  } catch (error) {
    // Cleanup must not replace the original failure or keep consuming a body.
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}
