import HTTPStatus from 'http-status';
import _ from 'lodash';
import jwt from 'jsonwebtoken';
import isPlainObject from 'is-plain-object';
import passport from 'passport';
import { Router } from 'express';
import moment from 'moment';

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
  ADULT_MEMBERSHIP_ITEMS_DEFAULTS,
  CHILDREN_MEMBERSHIP_ITEMS_DEFAULTS,
  DAYS,
} from '../../config/constants';


const router = new Router();


// util methods

function createDentistInfo(user) {
  Promise.all([
    user.createMembership({
      name: 'default membership',
      default: true,
      isActive: true,
      price: 0,
      withDiscount: 0,
      monthly: 0,
    }),

    user.createMembership({
      name: 'default child membership',
      default: true,
      isActive: true,
      withDiscount: 0,
      price: 0,
      monthly: 0,
    }),
  ]).then(([adult, child]) => {
    user.createDentistInfo({
      membershipId: adult.get('id'),
      childMembershipId: child.get('id'),
    }).then((info) => {
      DAYS.forEach(item => {
        info.createWorkingHour({ day: item });
      });
    });

    ADULT_MEMBERSHIP_ITEMS_DEFAULTS.forEach(item => {
      adult.createItem({
        pricingCode: item.code,
        price: 0,
      });
    });

    CHILDREN_MEMBERSHIP_ITEMS_DEFAULTS.forEach(item => {
      child.createItem({
        pricingCode: item.code,
        price: 0,
      });
    });
  });
}

// Middlewares

function normalUserSignup(req, res, next) {
  req.checkBody(NORMAL_USER_REGISTRATION);
  req.checkBody('confirmPassword', 'Password do not match').equals(req.body.password);
  req.checkBody('confirmEmail', 'Email do not match').equals(req.body.email);

  req
    .asyncValidationErrors(true)
    .then(() => {
      const user = req.body;
      user.verified = true;

      return new Promise((resolve, reject) => {
        db.User.register(user, user.password, (registerError, createdUser) => {
          if (registerError) {
            reject(registerError);
          } else {
            resolve(createdUser);

            res.mailer.send('auth/client/welcome', {
              to: user.email,
              subject: EMAIL_SUBJECTS.client.welcome,
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
    // .then(user => {
    //   db.DentistInfo.find({
    //     attributes: ['membershipId'],
    //     where: { userId: req.body.dentistId },
    //     include: [{
    //       model: db.Membership,
    //       as: 'membership',
    //       attributes: ['id', 'price', 'monthly'],
    //     }]
    //   }).then(info => {
    //     if (info) {
    //       const membership = info.membership.toJSON();
    //       const today = moment();
    //
    //       db.Subscription.create({
    //         startAt: today,
    //         endAt: today.add(1, 'months'),
    //         total: membership.price,
    //         monthly: membership.monthly,
    //         membershipId: membership.id,
    //         clientId: user.get('id'),
    //         dentistId: req.body.dentistId,
    //       });
    //     }
    //   });
    //
    //   return user;
    // })
    .then((user) => {
      const queries = [
        // This should be created so we can edit values
        user.createPhoneNumber({ number: '' }),
        user.createAddress({ value: '' }),
      ];

      // if (req.body.address2) {
      //   queries.push(user.createAddress({ value: req.body.address2 }));
      // }

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

function dentistUserSignup(req, res, next) {
  req.checkBody(DENTIST_USER_REGISTRATION);
  req.checkBody('confirmPassword', 'Password do not match').equals(req.body.password);
  req.checkBody('confirmEmail', 'Email do not match').equals(req.body.email);

  req
    .asyncValidationErrors(true)
    .then(() => {
      const user = _.omit(req.body, ['phone']);
      user.type = 'dentist';
      user.dentistSpecialtyId = req.body.specialtyId;

      return new Promise((resolve, reject) => {
        db.User.register(user, user.password, (registerError, createdUser) => {
          if (registerError) {
            reject(registerError);
          } else {
            resolve(createdUser);
            createDentistInfo(createdUser);
            res.mailer.send('auth/dentist/activation_required', {
              to: user.email,
              subject: EMAIL_SUBJECTS.client.activation_required,
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
    .then((user) => (
      Promise.all([
        user.createPhoneNumber({ number: req.body.phone }),
        // This should be created so we can edit values
        user.createAddress({ value: '' }),
      ])
    ))
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
          .then(() => {
            res.mailer.send('auth/activation_complete', {
              to: user.email,
              subject: EMAIL_SUBJECTS.activation_complete,
              site: process.env.SITE,
              user,
            }, (err, info) => {
              if (err) {
                console.log(err);
              }

              if (process.env.NODE_ENV === 'development') {
                console.log(info);
              }
            });

            res.json({});
          });
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

