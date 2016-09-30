import { Router } from 'express';
import passport from 'passport';
import HTTPStatus from 'http-status';

import db from '../../models';

import {
  MESSAGE,
} from '../../utils/schema-validators';

import {
  BadRequestError,
} from '../errors';


const router = new Router({ mergeParams: true });


function getMessages(req, res, next) {
  const query = {
    where: {},
    include: [{
      model: db.Message,
    }],
  };

  switch (req.user.get('type')) {
    case 'client':
      query.where.clientId = req.user.get('id');
      query.where.dentistId = req.params.recipentId;
      break;

    case 'dentist':
      query.where.dentistId = req.user.get('id');
      query.where.clientId = req.params.recipentId;
      break;

    default:
      break;
  }

  db.Conversation
    .findAll(query)
    .then(conversation => res.json(conversation.toJSON())).catch(next);
}


function addMessage(req, res, next) {
  req.checkBody(MESSAGE);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

  const data = {};

  switch (req.user.get('type')) {
    case 'client':
      data.clientId = req.user.get('id');
      data.dentistId = req.params.recipentId;
      break;

    case 'dentist':
      data.dentistId = req.user.get('id');
      data.clientId = req.params.recipentId;
      break;

    default:
      break;
  }

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
  .route('/:recipentId')
  .get(
    passport.authenticate('jwt', { session: false }),
    getMessages)
  .post(
    passport.authenticate('jwt', { session: false }),
    addMessage);


export default router;
