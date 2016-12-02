import { Router } from 'express';
import passport from 'passport';
import HTTPStatus from 'http-status';

import db from '../../models';

import {
  MESSAGE,
} from '../../utils/schema-validators';

import {
  NotFoundError,
  BadRequestError,
} from '../errors';


const router = new Router({ mergeParams: true });


function userQueryHelper(userType, userId, recipentId) {
  const where = {};

  if (userType === 'client') {
    where.clientId = userId;
    where.dentistId = recipentId;
  } else if (userType === 'dentist') {
    where.clientId = recipentId;
    where.dentistId = userId;
  }

  return where;
}

function getUnreadCount(req, res, next) {
  const where = userQueryHelper(
    req.user.get('type'),
    req.user.get('id'),
    req.params.recipentId
  );

  db.Conversation
    .find({ where })
    .then(conversation => {
      if (!conversation) {
        return res.json({
          data: { unread_count: 0 }
        });
      }

      return db.Message
        .count({
          where: {
            isRead: false,
            conversationId: conversation.id,
            userId: req.params.recipentId,
          }
        })
        .then(count => {
          res.json({
            data: { unread_count: count }
          });
        });
    })
    .catch(next);
}

function makeAllRead(req, res, next) {
  const where = userQueryHelper(
    req.user.get('type'),
    req.user.get('id'),
    req.params.recipentId
  );

  db.Conversation
    .find({ where })
    .then(conversation => {
      if (!conversation) {
        return next(new NotFoundError());
      }

      return conversation.id;
    })
    .then(conversationId => {
      db.Message.update({
        isRead: true
      }, {
        where: {
          isRead: false,
          conversationId,
          userId: req.params.recipentId,
        }
      })
      .then(() => {
        res.json({});
      });
    })
    .catch(next);
}

function getMessages(req, res, next) {
  const query = {
    where: {},
    include: [{
      model: db.Message,
      as: 'messages',
    }],
  };

  query.where = userQueryHelper(
    req.user.get('type'),
    req.user.get('id'),
    req.params.recipentId
  );

  db.Conversation
    .find(query)
    .then(conversation => {
      if (!conversation) {
        next(new NotFoundError());
      } else {
        res.json({
          data: conversation.toJSON()
        });
      }
    }).catch(next);
}


function addMessage(req, res, next) {
  req.checkBody(MESSAGE);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

  const data = userQueryHelper(
    req.user.get('type'),
    req.user.get('id'),
    req.params.recipentId
  );

  return db.Conversation
    .find({ where: data })
    .then(conversation => {
      if (!conversation) {
        return db.Conversation.create(data);
      }
      return conversation;
    })
    .then(conversation =>
      db.Message.create({
        conversationId: conversation.get('id'),
        body: req.body.message,
        userId: req.user.get('id'),
      })
    )
    .then(message => {
      res.status(HTTPStatus.CREATED);
      res.json(message.toJSON());
    })
    .catch(next);
}

router
  .route('/:recipentId/unread_count')
  .get(
    passport.authenticate('jwt', { session: false }),
    getUnreadCount);

router
  .route('/:recipentId/mark_all_read')
  .get(
    passport.authenticate('jwt', { session: false }),
    makeAllRead);

router
  .route('/:recipentId')
  .get(
    passport.authenticate('jwt', { session: false }),
    getMessages)
  .post(
    passport.authenticate('jwt', { session: false }),
    addMessage);


export default router;
