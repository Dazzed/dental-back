// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import HTTPStatus from 'http-status';

import db from '../../models';

import {
  MESSAGE,
} from '../../utils/schema-validators';

import {
  NotFoundError,
  BadRequestError,
} from '../errors';

import {
  userRequired,
} from '../middlewares';


// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Prepares a query for finding a user record
 *
 * @param {String} userType - the type of user to look for
 * @param {Number} userId - the id of the user record to find
 * @param {Number} recipientId - the id of the recipient account
 * @returns {Object} - the where clause of the query
 */
function userQueryHelper(userType, userId, recipientId) {
  const where = {};

  if (userType === 'client') {
    where.clientId = userId;
    where.dentistId = recipientId;
  } else if (userType === 'dentist') {
    where.clientId = recipientId;
    where.dentistId = userId;
  }

  return where;
}

/**
 * Counts the number of unread messages that exist
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function getUnreadCount(req, res, next) {
  const where = userQueryHelper(
    req.user.get('type'),
    req.user.get('id'),
    req.params.recipientId
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
            userId: req.params.recipientId,
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

/**
 * Marks all messages as read
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function makeAllRead(req, res, next) {
  const where = userQueryHelper(
    req.user.get('type'),
    req.user.get('id'),
    req.params.recipientId
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
          userId: req.params.recipientId,
        }
      })
      .then(() => {
        res.json({});
      });
    })
    .catch(next);
}

/**
 * Gets the messages for the user record requested
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
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
    req.params.recipientId
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

/**
 * Adds a new message record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function addMessage(req, res, next) {
  req.checkBody(MESSAGE);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

  const data = userQueryHelper(
    req.user.get('type'),
    req.user.get('id'),
    req.params.recipientId
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

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/:recipientId/unread_count')
  .get(
    userRequired,
    getUnreadCount);

router
  .route('/:recipientId/mark_all_read')
  .get(
    userRequired,
    makeAllRead);

router
  .route('/:recipientId')
  .get(
    userRequired,
    getMessages)
  .post(
    userRequired,
    addMessage);

export default router;
