import { Router } from 'express';
import passport from 'passport';

import db from '../../models';


const router = new Router({ mergeParams: true });


function getUnreadCount(req, res, next) {
  const where = {
    recipientId: req.user.get('id'),
    isRead: false
  };

  db.Notification
    .count({ where })
    .then(count => {
      res.json({
        data: { unread_count: count }
      });
    })
    .catch(next);
}

function makeAllRead(req, res, next) {
  const where = { recipientId: req.user.get('id') };

  db.Notification
    .update({ isRead: true }, { where })
    .then(() => {
      res.json({});
    })
    .catch(next);
}

function getNotifications(req, res, next) {
  const where = { recipientId: req.user.get('id') };

  db.Notification
    .findAll({ where })
    .then(notifications => {
      res.json({
        data: notifications
      });
    })
    .catch(next);
}

router
  .route('/unread_count')
  .get(
    passport.authenticate('jwt', { session: false }),
    getUnreadCount);

router
  .route('/mark_all_read')
  .get(
    passport.authenticate('jwt', { session: false }),
    makeAllRead);

router
  .route('/')
  .get(
    passport.authenticate('jwt', { session: false }),
    getNotifications);


export default router;
