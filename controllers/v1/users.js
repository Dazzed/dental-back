import { Router } from 'express';
import passport from 'passport';
import isPlainObject from 'is-plain-object';
import HTTPStatus from 'http-status';
import multer from 'multer';
import multerS3 from 'multer-s3';
import aws from 'aws-sdk';
import _ from 'lodash';

import db from '../../models';
import { EXCLUDE_FIELDS_LIST } from '../../models/user';
import { getCreditCardInfo } from '../payments';

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

const s3 = new aws.S3();
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.S3_BUCKER || 'dentalmarket',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    acl: 'public-read',
    key(req, file, cb) {
      cb(null, Date.now().toString());
    },
  }),
});


/**
 * Fill req.locals.user with the requested used on url params and
 * call next middleware if allowed.
 *
 */
export function getUserFromParam(req, res, next) {
  const userId = req.params.userId;

  if (userId === 'me' || req.user.get('id') === parseInt(userId, 10)) {
    req.locals.user = req.user;
    return next();
  }

  if (req.user.get('type') === 'client' && userId === 'me') {
    return next(new ForbiddenError());
  }

  let accountOwner;

  if (req.user.get('type') === 'client') {
    accountOwner = req.user.get('id');
  }

  return db.User.getActiveUser(userId, accountOwner).then((user) => {
    if (!user) {
      return next(new NotFoundError());
    }

    req.locals.user = user;
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
  req.locals.user.update({ isDeleted: true }).then(() => res.json({}));
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


function getCardInfo(req, res, next) {
  if (req.locals.user.get('authorizeId') && req.locals.user.get('paymentId')) {
    return getCreditCardInfo(
      req.locals.user.get('authorizeId'),
      req.locals.user.get('paymentId')
    ).then((info) => {
      res.json({ data: info });
    });
  }

  return next(new NotFoundError());
}


function uploadAvatar(req, res, next) {
  req.locals.user.update({ avatar: req.file })
    .then(() => {
      res.json({ data: req.file });
    })
    .catch(next);
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

router
  .route('/:userId/upload-avatar')
  .post(
    passport.authenticate('jwt', { session: false }),
    getUserFromParam,
    upload.single('avatar'),
    uploadAvatar);

router
  .route('/:userId/credit-card')
  .get(
    passport.authenticate('jwt', { session: false }),
    getUserFromParam,
    getCardInfo);


export default router;
