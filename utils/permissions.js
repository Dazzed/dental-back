import db from '../models';

import {
  ForbiddenError,
} from '../controllers/errors';


export function checkUserDentistPermission(req, res, next) {
  const userId = req.params.userId;

  const canEdit =
    userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
    req.user.get('type') === 'admin';

  if (!canEdit && req.user.get('type') !== 'dentist') {
    return next(new ForbiddenError());
  }

  // last try to see if subscription exists and is related to
  // account holder.
  if (req.user.get('type') === 'dentist' && !canEdit) {
    return db.Subscription.getCurrentSubscription(userId)
      .then(subscription => {
        if (subscription &&
          subscription.get('dentistId') !== req.user.get('id')) {
          return next(new ForbiddenError());
        }

        return next();
      })
      .catch(next);
  }

  return next();
}
