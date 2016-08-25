import HTTPStatus from 'http-status';
import _ from 'lodash';
import jwt from 'jsonwebtoken';
import isPlainObject from 'is-plain-object';
import passport from 'passport';
import { Router } from 'express';

import db from '../../models';

import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../errors';

import {
  NORMAL_USER_REGISTRATION,
  DENTIST_USER_REGISTRATION,
} from '../../utils/schema-validators';

import {
  EMAIL_SUBJECTS,
  DEFAULT_MEMBERSHIPS,
} from '../../config/constants';


const router = new Router();


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
        db.User.register(user, user.password, (registerError, createdUser) => {
          if (registerError) {
            reject(registerError);
          } else {
            resolve(createdUser);

            res.mailer.send('auth/client/signup', {
              to: user.email,
              subject: EMAIL_SUBJECTS.client.signup,
              site: process.env.SITE,
              user: createdUser,
            }, (err, info) => {
              if (err) {
                console.log(err);
              }

              if (process.env.NODE_ENV === 'development') {
                console.log(info);
              }
            });
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
        db.User.register(user, user.password, (registerError, createdUser) => {
          if (registerError) {
            reject(registerError);
          } else {
            resolve(createdUser);
            res.mailer.send('auth/dentist/signup', {
              to: user.email,
              subject: EMAIL_SUBJECTS.client.signup,
              site: process.env.SITE,
              user: createdUser,
            }, (err, info) => {
              if (err) {
                console.log(err);
              }

              if (process.env.NODE_ENV === 'development') {
                console.log(info);
              }
            });
          }
        });
      });
    })
    .then((user) => {
      const queries = [
        user.createPhoneNumber({ number: req.body.phone }),
        user.createAddress({ value: '' }),
      ];

      DEFAULT_MEMBERSHIPS.forEach((item) => {
        queries.push(db.Membership.create({
          name: item.name,
          price: item.price,
          description: item.description,
          userId: user.get('id')
        }));
      });

      return Promise.all(queries);
    })
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


function activate(req, res, next) {
  db.User.find({ where: { activationKey: req.params.key } })
    .then((user) => {
      if (user) {
        // activate it
        return user
          .update({ verified: true, activationKey: null })
          .then(() => res.end());
      }

      return next(new NotFoundError());
    })
    .catch((errors) => {
      next(errors);
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

    if (user.isDeleted) {
      return next(new NotFoundError());
    }

    if (!user.verified) {
      return next(new ForbiddenError('Account was not activated.'));
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

router
  .route('/activate/:key')
  .get(activate);


export default router;

