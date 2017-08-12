// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import HTTPStatus from 'http-status';
import _ from 'lodash';
import jwt from 'jsonwebtoken';
import isPlainObject from 'is-plain-object';
import passport from 'passport';
import { Router } from 'express';
import db from '../../models';

import stripe from '../stripe';

import {
  SUBSCRIPTION_TYPES,
  SUBSCRIPTION_TYPES_LOOKUP,
  SUBSCRIPTION_AGE_GROUPS,
  SUBSCRIPTION_AGE_GROUPS_LOOKUP,
} from '../../config/constants';

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

import Mailer from '../mailer';

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

  return user.createDentistInfo(dentistInfo, { transaction })
  .then((info) => {
    let promises = [];

    promises.push(user.createMembership({
      name: 'default monthly membership',
      price: !_.isNil(pricing.adultMonthlyFee) && _.isFinite(_.toNumber(pricing.adultMonthlyFee)) ? _.toNumber(pricing.adultMonthlyFee) : 19.99,
      discount: pricing.treatmentDiscount || 0,
      type: SUBSCRIPTION_TYPES_LOOKUP.month,
      subscription_age_group: SUBSCRIPTION_AGE_GROUPS_LOOKUP.adult,
      dentistInfoId: info.id,
    }, { transaction }));

    promises.push(user.createMembership({
      name: 'default monthly child membership',
      price: !_.isNil(pricing.childMonthlyFee) && _.isFinite(_.toNumber(pricing.childMonthlyFee)) ? _.toNumber(pricing.childMonthlyFee) : 14.99,
      discount: pricing.treatmentDiscount || 0,
      type: SUBSCRIPTION_TYPES_LOOKUP.month,
      subscription_age_group: SUBSCRIPTION_AGE_GROUPS_LOOKUP.child,
      dentistInfoId: info.id,
    }, { transaction }));

    promises.push(!_.isNil(pricing.adultYearlyFeeActivated) && pricing.adultYearlyFeeActivated &&
        !_.isNil(pricing.adultYearlyFee) && _.isFinite(_.toNumber(pricing.adultYearlyFee)) ?
      user.createMembership({
        name: 'default annual membership',
        price: _.toNumber(pricing.adultYearlyFee),
        discount: pricing.treatmentDiscount || 0,
        type: SUBSCRIPTION_TYPES_LOOKUP.year,
        subscription_age_group: SUBSCRIPTION_AGE_GROUPS_LOOKUP.adult,
        dentistInfoId: info.id,
      }, { transaction }) : Promise.resolve());

    promises.push(!_.isNil(pricing.childYearlyFeeActivated) && pricing.childYearlyFeeActivated &&
        !_.isNil(pricing.childYearlyFee) && _.isFinite(_.toNumber(pricing.childYearlyFee)) ?
      user.createMembership({
        name: 'default annual child membership',
        price: _.toNumber(pricing.childYearlyFee),
        discount: pricing.treatmentDiscount || 0,
        type: SUBSCRIPTION_TYPES_LOOKUP.year,
        subscription_age_group: SUBSCRIPTION_AGE_GROUPS_LOOKUP.child,
        dentistInfoId: info.id,
      }, { transaction }) : Promise.resolve());

    workingHours.forEach((item) => {
      promises.push(
        info.createWorkingHour(item, { transaction })
        .catch(e => console.log(e))
      );
    });

    (pricing.codes || []).forEach((item) => {
      promises.push(
        db.MembershipItem.create({
          pricingCodeId: item.id,
          price: item.amount,
          dentistInfoId: info.get('id')
        }, { transaction })
      );
    });

    // create service records for the dentist.
    services.forEach((item) => {
      promises.push(
        info.createService({ serviceId: item }, { transaction })
        .catch(e => console.log(e))
      );
    });

    officeImages.forEach((url) => {
      promises.push(
        db.DentistInfoPhotos.create({
          url, dentistInfoId: info.get('id')
        }, { transaction })
      );
    });

    return Promise.all(promises);

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
  let userObj = null;
  let customerId = null;

  req
  .asyncValidationErrors(true)
  .then(() => {
    data.verified = true;
    // Create the new user account
    return new Promise((resolve, reject) => {
      db.User.register(data, data.password, (err, user) => {
        if (err) reject(err);
        resolve(user);
      });
    });
  })
  .then((user) => {
    userObj = user;
    const { stripeToken } = data;
    return stripe.createCustomer(user.email, stripeToken);
  })
  .then((customer) => {
    customerId = customer.id;

    return db.sequelize.transaction((t) => {
      const queries = [];

      // Add subscription
      //If primaryAccountHolder wants to subscribe
      if (req.body.membershipId) {
        queries.push(
          db.Subscription.create({
            clientId: userObj.id,
            membershipId: Number(req.body.membershipId) || null,
            dentistId: req.body.dentistId || null,
            paymentProfile: {
              stripeCustomerId: customer.id,
              primaryAccountHolder: userObj.id,
            }
          }, {
            transaction: t,
            include: [{
              model: db.PaymentProfile,
              as: 'paymentProfile',
              include: [{ all: true }]
            }],
          })
        );
      }
      // If primaryAccountHolder Doesn't want to subscribe but his childrens do. 
      else {
        queries.push(
          db.PaymentProfile.create({
            stripeCustomerId: customer.id,
            primaryAccountHolder: userObj.id,
          }, {
            transaction: t,
          })
        );
      }

      // Add phone number
      if (req.body.phone) {
        queries.push(userObj.createPhoneNumber({ number: req.body.phone || '' }, { transaction: t }));
      }

      // Add address
      if (req.body.address) {
        queries.push(userObj.createAddress({ value: req.body.address || '' }, { transaction: t }));
      }

      return Promise.all(queries)
      .then(() => {
        let membersCreationQueries = [];
        if(req.body.members) {
          req.body.members.forEach((member) => {
            membersCreationQueries.push(db.User.addMember(
              _.assign({
                dentistId: req.body.dentistId
              }, member),
              userObj,
              t
            ));
          });
        }
        return Promise.all(membersCreationQueries);
      });
    });
  })
  .then(() => {

    const excludedKeys = ['hash', 'salt', 'verified', 'authorizeId',
      'paymentId', 'activationKey', 'resetPasswordKey', 'isDeleted'];

    res
    .status(HTTPStatus.CREATED)
    .json({ data: [_.omit(userObj.toJSON(), excludedKeys)] });
  })
  .catch((errors) => {
    const done = () => {
      res
      .status(HTTPStatus.BAD_REQUEST)
      .json(errors);
    };

    // Delete the user object that was created
    return Promise.all([
      db.User.destroy({
        where: { id: userObj.id }
      }),
      stripe.deleteCustomer(customerId),
    ]).then(done, done);
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
    return db.sequelize.transaction((t) => {
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
          }
        });
      })
      .then(userObj => {
        return Promise.all([
          createDentistInfo(userObj, req.body, t),
          Mailer.activationRequestEmail(res, userObj),
          userObj.createPhoneNumber({ number: req.body.user.phone }, { transaction: t }),
          // This should be created so we can edit values
          userObj.createAddress({ value: '' }, { transaction: t }),
        ])
      });
    })
    .then(() => {
      res
      .status(HTTPStatus.CREATED)
      .json({});
      // Mailer.dentistSignupEmail(res, req.body.user);
    })
    .catch(next);
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
      // Activate the User Account
      return user
      .update({ verified: true, activationKey: null })
      .then(() => Mailer.activationCompleteEmail(res, user))
      .then(() => {
        return res.json({});
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

/**
 * Send a request to reset the password.
 */
function forgotPassword(req, res, next) {
  if (!req.body.email) return next(new BadRequestError('Missing email'));

  return db.User.find({
    where: {
      email: db.sequelize.fn('lower', req.body.email)
    }
  })
    .then(user => {
      console.log(user.get('email'));

      if (!user) return Promise.reject(new NotFoundError());

      const token = user.getPasswordResetToken();

      return Mailer.passwordResetEmail(res, user, token);
    })
    .then(() => res.json({}))
    .catch(next);
}

/**
 * Quickly check password reset validity.
 */
function checkResetPassword(req, res, next) {
  if (!req.query.token) return next(new BadRequestError('Missing token'));

  const { valid } = db.User.resetPasswordTokenValidity(req.query.token);

  return res.json({ valid });
}

/**
 * Reset the user password.
 */
function resetPassword(req, res, next) {
  if (!req.body.token) return next(new BadRequestError('Missing token'));
  if (!req.body.password) return next(new BadRequestError('Missing new password'));

  return db.User.resetPasswordByToken(req.body.token, req.body.password)
    .then(success => res.json({ success }))
    .catch(next);
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/forgot-password')
  .post(forgotPassword);

router
  .route('/reset-password')
  .get(checkResetPassword)
  .post(resetPassword);

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
    res.json();
  });

router
  .route('/signup')
  .post(
    validateBody(NORMAL_USER_REGISTRATION),
    normalUserSignup);

router
  .route('/dentist-signup')
  .post(
    validateBody(DENTIST_USER_REGISTRATION, body => body.user),
    dentistUserSignup);

router
  .route('/activate/:key')
  .get(activate);

export default router;
