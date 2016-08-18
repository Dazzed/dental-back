import HTTPStatus from 'http-status';
import _ from 'lodash';
import jwt from 'jsonwebtoken';
import isPlainObject from 'is-plain-object';
import passport from 'passport';
import { Router } from 'express';

import db from '../../models';
import { BadRequestError } from '../errors';


import {
  NORMAL_USER_REGISTRATION,
  DENTIST_USER_REGISTRATION,
} from '../../utils/schema-validators';

const router = new Router();


// Utils functions

// function createAvatar(model, field) {
//   if (field) {
//     const data = `${field.filename}${new Date().toISOString()}`;
//     const filename = crypto.createHash('md5').update(data).digest('hex');
//
//     // TODO: send to S3
//
//     model.avatar = {  // eslint-disable-line  no-param-reassign
//       filename,
//       filetype: field.filetype,
//     };
//
//     model.save();
//   }
// }
//
// Middlewares

function normalUserSignup(req, res, next) {
  req.checkBody(NORMAL_USER_REGISTRATION);
  req.checkBody('confirmPassword', 'Password do not match').equals(req.body.password);
  req.checkBody('confirmEmail', 'Email do not match').equals(req.body.email);

  req
    .asyncValidationErrors(true)
    .then(() => {
      const user = req.body;

      return new Promise((resolve, reject) => {
        db.User.register(user, user.password, (err, createdUser) => {
          if (err) {
            reject(err);
          } else {
            resolve(createdUser);
          }
        });
      });
    })
    .then((user) => Promise.all([
      user.createPhoneNumber({ number: '' }),
      user.createAddress({ value: '' }),
    ]))
    .then(() => {
      res
        .status(HTTPStatus.CREATED)
        .json({});
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
}

function dentistUserSignup(req, res, next) {
  req.checkBody(DENTIST_USER_REGISTRATION);
  req.checkBody('confirmPassword', 'Password do not match').equals(req.body.password);
  req.checkBody('confirmEmail', 'Email do not match').equals(req.body.email);

  req
    .asyncValidationErrors(true)
    .then(() => {
      const user = _.omit(req.body, ['phone']);
      user.type = 'dentist';

      return new Promise((resolve, reject) => {
        db.User.register(user, user.password, (err, createdUser) => {
          if (err) {
            reject(err);
          } else {
            resolve(createdUser);
          }
        });
      });
    })
    .then((user) => Promise.all([
      user.createPhoneNumber({ number: req.body.phone }),
      user.createAddress({ value: '' }),
    ]))
    .then(() => {
      res
        .status(HTTPStatus.CREATED)
        .json({});
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
}


function login(req, res, next) {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return next(new BadRequestError(null, info.message));
    }

    res.status(HTTPStatus.CREATED);
    const response = _.pick(user.toJSON(), ['type']);
    response.token = jwt.sign({ id: user.get('id') }, process.env.JWT_SECRET);
    return res.json(response);
  })(req, res, next);
}


// Bind with routes
router
  .route('/login')
  .post(login);


router
  .route('/logout')
  .get((req, res) => {
    res.end();
  });


router
  .route('/signup')
  .post(normalUserSignup);


router
  .route('/dentist-signup')
  .post(dentistUserSignup);

export default router;
