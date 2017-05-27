// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import HTTPStatus from 'http-status';
import _ from 'lodash';
import jwt from 'jsonwebtoken';
import isPlainObject from 'is-plain-object';
import passport from 'passport';
import moment from 'moment';
import { Router } from 'express';
import db from '../../models';

import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../errors';

import {
  validateBody,
} from '../middlewares';

import {
  NORMAL_USER_REGISTRATION,
  DENTIST_USER_REGISTRATION
} from '../../utils/schema-validators';

import {
  EMAIL_SUBJECTS
} from '../../config/constants';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Creates a dentist info record
 *
 * @param {Object} user - the related user object for the record
 * @param {Object} body - the new dentist info record
 * @param {Object} transaction - the sequelize transaction object
 */
function createDentistInfo(user, body, transaction) {
  const dentistInfo = body.officeInfo;
  const pricing = body.pricing || {};
  const workingHours = body.workingHours || [];
  const services = body.services || [];
  const officeImages = dentistInfo.officeImages || [];

  Promise.all([
    user.createMembership({
      name: 'default membership',
      default: true,
      isActive: true,
      price: 0,
      withDiscount: pricing.treatmentDiscount || 0,
      discount: pricing.treatmentDiscount || 0,
      monthly: pricing.adultMonthlyFee,
      yearly: pricing.adultYearlyFeeActivated ?
              pricing.adultYearlyFee || null : null,
      adultYearlyFeeActivated: pricing.adultYearlyFeeActivated
    }),

    user.createMembership({
      name: 'default child membership',
      default: true,
      isActive: true,
      price: 0,
      withDiscount: pricing.treatmentDiscount || 0,
      discount: pricing.treatmentDiscount || 0,
      monthly: pricing.childMonthlyFee,
      yearly: pricing.childYearlyFeeActivated ?
              pricing.childYearlyFee || null : null,
      childYearlyFeeActivated: pricing.childYearlyFeeActivated
    })
  ])
  .then(([adult, child]) => {
    user.createDentistInfo(
      Object.assign({
        membershipId: adult.get('id'),
        childMembershipId: child.get('id')
      }, dentistInfo),
      { transaction }
    ).then((info) => {
      workingHours.forEach(item => {
        info.createWorkingHour(item);
      });

      // create service records for the dentist.
      services.forEach(item => {
        info.createService({ serviceId: item })
        .catch(e => console.log(e));
      });

      // create pricing records for the dentist.
      (pricing.codes || []).forEach(item => {
        db.MembershipItem.create({
          pricingCodeId: item.code,
          price: item.amount,
          dentistInfoId: info.get('id')
        });
      });

      officeImages.forEach(url => {
        db.DentistInfoPhotos.create({
          url, dentistInfoId: info.get('id')
        });
      });
    });
  });
}

/**
 * Registers a new user account
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function normalUserSignup(req, res, next) {
  req.checkBody('confirmPassword', 'Password do not match').equals(req.body.password);
  req.checkBody('confirmEmail', 'Email do not match').equals(req.body.email);

  const data = req.body;

  req
  .asyncValidationErrors(true)
  .then(() => {
    data.verified = true;

    return new Promise((resolve, reject) => {
      db.User.register(data, data.password, (registerError, createdUser) => {
        if (registerError) {
          return reject(registerError);
        }
        return resolve(createdUser);
      });
    });
  })
  .then((createdUser) => {
    db.DentistInfo.find({
      attributes: ['membershipId', 'userId'],
      where: { id: data.officeId }
    })
    .then(info => {
      db.Subscription.create({
        startAt: moment(),
        endAt: moment(),
        clientId: createdUser.id,
        dentistId: info.get('userId'),
      });
    });
    return createdUser;
  })
  .then((user) => {
    const queries = [
      user,
    ];

    if (req.body.officeId && req.body.membershipId) {
      queries.push(user.createSubscription({
        membershipId: req.body.membershipId,
        dentistId: req.body.officeId,
      }));
    }

    if (req.body.phone) {
      queries.push(user.createPhoneNumber({ number: req.body.phone || '' }));
    }

    if (req.body.address) {
      queries.push(user.createAddress({ value: req.body.address || '' }));
    }

    if (req.body.members) {
      req.body.members.forEach(member => {
        queries.push(db.User.addMember(member, user));
      });
    }

    return Promise.all(queries);
  })
  .then(([user]) => {
    const excludedKeys = ['hash', 'salt', 'verified', 'authorizeId',
      'paymentId', 'activationKey', 'resetPasswordKey', 'isDeleted'];

    res
    .status(HTTPStatus.CREATED)
    .json({ data: [_.omit(user.toJSON(), excludedKeys)] });
  })
  .catch((errors) => {
    if (isPlainObject(errors)) {
      return next(new BadRequestError(errors));
    }

    return next(errors);
  });
}

/**
 * Registers a new dentist user account
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function dentistUserSignup(req, res, next) {
  req.checkBody('user.confirmPassword', 'Password does not match').equals(req.body.user.password);
  req.checkBody('user.confirmEmail', 'Email does not match').equals(req.body.user.email);

  req
  .asyncValidationErrors(true)
  .then(() => {
    db.sequelize.transaction(t => {
      const user = _.omit(req.body.user, ['phone']);
      user.type = 'dentist';
      user.dentistSpecialtyId = req.body.user.specialtyId;

      return new Promise((resolve, reject) => {
        // User reg is not part of the transaction
        db.User.register(user, user.password, (registerError, createdUser) => {
          if (registerError) {
            reject(registerError);
          } else {
            resolve(createdUser);
            // Create the Dentist Office record
            createDentistInfo(createdUser, req.body);
            res.mailer.send('auth/dentist/activation_required', {
              to: user.email,
              subject: EMAIL_SUBJECTS.client.activation_required,
              site: process.env.SITE,
              user: createdUser,
            }, (err, info) => {
              if (err) console.log(err);
            });
          }
        });
      })
      .then((user) => (
        Promise.all([
          user.createPhoneNumber({ number: req.body.user.phone }, { transaction: t }),
          // This should be created so we can edit values
          user.createAddress({ value: '' }, { transaction: t }),
        ])
      ));
    })
    .then(() => {
      res
      .status(HTTPStatus.CREATED)
      .json({});
    });
  })
  .catch((errors) => {
    if (isPlainObject(errors)) {
      return next(new BadRequestError(errors));
    }

    return next(errors);
  });
}

/**
 * Activates a user account
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
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

/**
 * Attempts to login as a user account and provide a session token
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
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

/**
 * Attempts to login as an administrator
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function adminLogin(req, res, next) {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return next(new BadRequestError(null, info.message));
    if (user.isDeleted) return next(new NotFoundError());
    if (!user.verified) return next(new ForbiddenError('Account was not activated.'));
    if (user.type !== 'admin') return next(new ForbiddenError('User account is not an admin'));

    res.status(HTTPStatus.CREATED);
    const response = _.pick(user.toJSON(), ['type']);
    response.token = jwt.sign({ id: user.get('id') }, process.env.JWT_SECRET);
    return res.json(response);
  })(req, res, next);
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/login')
  .post(login);

router
  .route('/admin/login')
  .post(adminLogin);

router
  .route('/logout')
  .get((req, res) => {
    req.logout();
    res.end();
  });

router
  .route('/signup')
  .post(
    validateBody(NORMAL_USER_REGISTRATION),
    normalUserSignup);

router
  .route('/dentist-signup')
  .post(
    validateBody(DENTIST_USER_REGISTRATION, (body) => body.user),
    dentistUserSignup);

router
  .route('/activate/:key')
  .get(activate);

export default router;
