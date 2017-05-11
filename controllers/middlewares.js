import passport from 'passport';
import { WEBHOOK_EVENT } from '../utils/schema-validators';

import db from '../models';
import { BadRequestError, ForbiddenError } from './errors';

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

/**
 * Middleware that request if user is admin to allow next middleware
 */
export function dentistRequired(req, res, next) {
  if (req.user && (req.user.type === 'dentist' || req.user.type === 'admin')) {
    return next();
  }

  return next(new ForbiddenError());
}

/**
 * Adds the webhook event into the webhooks table
 */
export function trackHookEvent(req, res, next) {
  req.checkBody(WEBHOOK_EVENT);

  db.Webhooks.create({
    webhookId: req.body.webhookId,
    notificationId: req.body.notificationId,
    eventType: req.body.eventType
  }).then(() => {
    // Move the content up
    req.body = req.body.payload;
    next();
  }).catch(err => next(new BadRequestError(err)));
}

export const userRequired = passport.authenticate('jwt', { session: false });
