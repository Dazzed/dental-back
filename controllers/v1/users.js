import { Router } from 'express';
import passport from 'passport';
import isPlainObject from 'is-plain-object';
import HTTPStatus from 'http-status';
import _ from 'lodash';

import db from '../../models';
import { EXCLUDE_FIELDS_LIST } from '../../models/user';

import {
  NORMAL_USER_EDIT,
  DENTIST_USER_EDIT,
} from '../../utils/schema-validators';

import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../errors';


const router = new Router();


/**
 * Fill req.locals.user with the requested used on url params and
 * call next middleware if allowed.
 *
 */
export function getUserFromParam(req, res, next) {
  const userId = req.params.userId;

  if (userId === 'me' || req.user.get('id') === parseInt(userId, 10)) {
    req.locals.user = req.user;  // eslint-disable-line no-param-reassign
    return next();
  }

  if (req.user.get('type') !== 'admin') {
    return next(new ForbiddenError());
  }

  return db.User.getActiveUser(userId).then((user) => {
    if (!user) {
      return next(new NotFoundError());
    }

    return next();
  }).catch((error) => {
    next(error);
  });
}


function getUser(req, res) {
  return res.json({
    data: req.locals.user.toJSON(),
  });
}


function deleteUser(req, res) {
  req.locals.user.update({ isDeleted: true }).then(() => res.json());
}


// TODO: maybe later add avatar support?? or another endpoint
function updateUser(req, res, next) {
  const validator = Object.assign({}, req.locals.user.type === 'client' ?
    NORMAL_USER_EDIT : DENTIST_USER_EDIT);

  if (req.locals.user.get('email') === req.body.email) {
    delete validator.email.isDBUnique;
  }

  if (req.locals.user.get('specialtyId') === req.body.specialtyId
    && validator.specialtyId) {
    delete validator.specialtyId.existsInDB;
  }

  req.checkBody(validator);

  req
    .asyncValidationErrors(true)
    .then(() => {
      const body = _.omit(req.body, EXCLUDE_FIELDS_LIST);

      // NOTE: This should later removed to add and remove by others endpoints
      const phone = req.locals.user.get('phoneNumbers')[0];
      const address = req.locals.user.get('addresses')[0];

      phone.set('number', req.body.phone);
      address.set('value', req.body.address);

      return Promise.all([
        req.locals.user.update(body),
        phone.save(),
        address.save(),
      ]);
    })
    .then(() => db.User.getActiveUser(req.locals.user.get('id')))
    .then((user) => {
      res
        .status(HTTPStatus.OK)
        .json({ data: user.toJSON() });
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
}


router
  .route('/:userId')
  .get(
    passport.authenticate('jwt', { session: false }),
    getUserFromParam,
    getUser)
  .delete(
    passport.authenticate('jwt', { session: false }),
    getUserFromParam,
    deleteUser)
  .put(
    passport.authenticate('jwt', { session: false }),
    getUserFromParam,
    updateUser);


export default router;
