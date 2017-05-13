import crypto from 'crypto';
import passport from 'passport';
import HTTPStatus from 'http-status';
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

  return res.json({ error: new ForbiddenError() });
}

/**
 * Middleware that request if user is admin to allow next middleware
 */
export function dentistRequired(req, res, next) {
  if (req.user && (req.user.type === 'dentist' || req.user.type === 'admin')) {
    return next();
  }

  return res.json({ error: new ForbiddenError() });
}

/**
 * Middleware to track a user login
 */
export function userRequired(req, res, next) {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err || user == null) {
      res.json({ data: { error: 'Failed to authenticate' } });
    } else {
      req.user = user;
      next();
    }
  })(req, res, next);
}

/**
 * Adds the webhook event into the webhooks table
 */
export function trackHookEvent(req, res, next) {
  req.checkBody(WEBHOOK_EVENT);

  db.Webhooks.create({
    webhookId: req.body.webhookId,
    notificationId: req.body.notificationId,
    eventType: req.body.eventType,
    createdAt: req.body.eventDate,
  }).then(() => {
    // Move the content up
    req.body = req.body.payload;
    next();
  }).catch(err => next(new BadRequestError(err)));
}

/**
 * Checks if the body of the request is a valid HMAC-SHA 512 hash
 */
export function validateHook(req, res, next) {
  const contents = JSON.stringify(req.body);
  const hash = crypto.createHmac('sha512', process.env.AUTHORIZE_SIGNATURE_KEY).update(contents);
  const value = hash.digest('base64');

  if (value === req.get('X-ANET-Signature')) {
    next();
  } else {
    res.status(HTTPStatus.FORBIDDEN);
    res.send('Forbidden');
  }
}
