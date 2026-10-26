import type { RequestHandler } from 'express';

/** All clients and signed workers send identity request bodies. Reject encoded
 * entities before a parser can construct a decompression stream. Responses may
 * still be compressed by the hosting proxy; Accept-Encoding is unrelated.
 */
export const rejectEncodedRequestBodies: RequestHandler = (req, res, next) => {
  const encoding = req.headers['content-encoding'];
  if (encoding === undefined || (typeof encoding === 'string' && encoding.trim().toLowerCase() === 'identity')) return next();
  return res.status(415).json({ code: 'unsupported_content_encoding', error: 'Encoded request bodies are not supported.' });
};
