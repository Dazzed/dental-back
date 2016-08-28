import { ForbiddenError } from './errors';


/**
 * Middleware that request if user is admin to allow next middleware.
 *
 */
export function adminRequired(req, res, next) {
  if (req.user && req.user.type === 'admin') {
    return next();
  }

  return next(new ForbiddenError());
}
