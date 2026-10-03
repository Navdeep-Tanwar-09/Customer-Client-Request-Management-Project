import { Request, Response } from 'express';

/**
 * RFC 9457 Problem Details response with two legacy aliases (`error` and
 * `message`) retained while the web client migrates to the standard fields.
 */
export function sendProblem(
  req: Request,
  res: Response,
  status: number,
  code: string,
  detail: string,
  errors?: Record<string, string>,
): void {
  const title = status === 400 ? 'Bad Request'
    : status === 401 ? 'Unauthorized'
    : status === 403 ? 'Forbidden'
    : status === 404 ? 'Not Found'
    : status === 405 ? 'Method Not Allowed'
    : status === 409 ? 'Conflict'
    : status === 413 ? 'Content Too Large'
    : status === 415 ? 'Unsupported Media Type'
    : status === 422 ? 'Unprocessable Content'
    : status === 429 ? 'Too Many Requests'
    : status === 503 ? 'Service Unavailable'
    : 'Internal Server Error';

  res.status(status).type('application/problem+json').json({
    type: `https://client-request-desk.dev/problems/${code.toLowerCase().replace(/_/g, '-')}`,
    title,
    status,
    detail,
    instance: req.originalUrl,
    code,
    ...(errors ? { errors, details: errors } : {}),
    // Backwards-compatible aliases used by the existing UI.
    error: code,
    message: detail,
  });
}
