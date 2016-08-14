import { ForbiddenError } from './errors';


export function adminRequired(req, res, next) {
  if (req.user && req.user.type === 'admin') {
    return next();
  }

  return next(new ForbiddenError());
}
