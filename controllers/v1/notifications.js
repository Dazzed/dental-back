// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import {
  userRequired,
} from '../middlewares';

import { BadRequestError } from '../errors';

import db from '../../models';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets the count of unread notifications
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getUnreadCount(req, res, next) {
  const where = {
    recipientId: req.user.get('id'),
    isRead: false
  };

  db.Notification
  .count({ where })
  .then((count) => {
    res.json({
      data: { unread_count: count }
    });
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Marks all notifications for a user as read
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function makeAllRead(req, res, next) {
  const where = { recipientId: req.user.get('id') };

  db.Notification
  .update({ isRead: true }, { where })
  .then(() => {
    res.json({});
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Gets a list of notifications for a user record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getNotifications(req, res, next) {
  const where = { recipientId: req.user.get('id') };

  db.Notification
  .findAll({ where })
  .then((notifications) => {
    res.json({
      data: notifications
    });
  })
  .catch(err => next(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/unread_count')
  .get(
    userRequired,
    getUnreadCount);

router
  .route('/mark_all_read')
  .get(
    userRequired,
    makeAllRead);

router
  .route('/')
  .get(
    userRequired,
    getNotifications);

export default router;
