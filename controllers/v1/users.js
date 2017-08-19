/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import isPlainObject from 'is-plain-object';
import HTTPStatus from 'http-status';
import _ from 'lodash';

import db from '../../models';
import stripe from '../stripe';
import { EXCLUDE_FIELDS_LIST } from '../../models/user';
import { CARD_EXCLUDE_FIELDS_LIST } from '../../models/payment-profile';

import {
  NEW_EMAIL_VALIDATOR,
  NEW_PASSWORD_VALIDATOR,
  NORMAL_USER_EDIT,
  PATIENT_EDIT,
  STRIPE_TOKEN,
} from '../../utils/schema-validators';

import {
  validateBody,
  validateParams,
  validatePaymentManager,
  verifyPasswordLocal,
} from '../middlewares';

import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError
} from '../errors';

import {
  subscribeUserAndMembers
} from '../../utils/subscribe';
// ────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE

/**
 * Verifies a user account password
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function verifyPassword(req, res) {
  res.json({ passwordVerified: req.locals.passwordVerified });
}

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a user account record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getUser(req, res, next) {
  let userReq = null;

  if (req.locals.user.get('type') === 'dentist') {
    // Get full dentist
    userReq = req.locals.user.getFullDentist();
  } else if (req.locals.user.get('type' === 'client')) {
    // Get full user
    userReq = req.locals.user.getFullClient();
  } else {
    return next(new BadRequestError('Requested user is not a valid user type for this call'));
  }

  return userReq
  .then(data => res.json({ data }))
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Deletes a user account record (soft delete)
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function deleteUser(req, res) {
  req.locals.user.update({ isDeleted: true }).then(() => res.json({}));
}

/**
 * Updates a user record account
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function updateUser(req, res, next) {
  // TODO: maybe later add avatar support?? or another endpoint
  // const validator = Object.assign({}, req.locals.user.type === 'client' ?
  //   NORMAL_USER_EDIT : DENTIST_USER_EDIT);
  const validator = NORMAL_USER_EDIT;

  if (req.locals.user.get('newEmail') === req.body.email) {
    delete validator.newEmail.isDBUnique;
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

    // TODO: This should later removed to add and remove by others endpoints
    const phone = req.locals.user.get('phoneNumbers')[0];
    const address = req.locals.user.get('addresses')[0];
    const password = req.body.oldPassword || req.body.password;

    phone.set('number', req.body.phone);
    address.set('value', req.body.address);

    return Promise.all([
      req.locals.user.update(body),
      new Promise((resolve, reject) => {
        req.locals.user.setPassword(password, (err) => {
          if (err) return reject(err);
          return resolve();
        });
      }),
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

    return next(new BadRequestError(errors));
  });
}

/**
 * Updates a patient account record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function updatePatient(req, res, next) {
  Promise.resolve()
  .then(() => {
    const body = _.omit(req.body, EXCLUDE_FIELDS_LIST);

    const mainUser = req.locals.user;

    const phone = mainUser.get('phoneNumbers')[0];
    const address = mainUser.get('addresses')[0];

    const where = {};
    where.id = req.params.patientId;

    if (mainUser.get('id') !== parseInt(req.params.patientId, 0)) {
      where.addedBy = mainUser.get('id');
    }

    return db.User.findOne({ where })
    .then((patient) => {
      if (!patient) return next(new NotFoundError());

      if (patient.get('id') === mainUser.get('id')) {
        phone.set('number', req.body.phone);
        address.set('value', req.body.address);
      }

      return Promise.all([
        patient.update(body),
        phone.save(),
        address.save()
      ]);
    })
    .then(() => res.json({}))
    .catch(err => next(new BadRequestError(err)));
  })
  .catch((errors) => {
    if (isPlainObject(errors)) {
      return next(new BadRequestError(errors));
    }

    return next(new BadRequestError(errors));
  });
}

/**
 * Updates the user account authorization (i.e. Password)
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function updateAuth(req, res, next) {
  let validator = {};

  if (req.body.newEmail) {
    validator = NEW_EMAIL_VALIDATOR;

    if (req.locals.user.get('email') === req.body.newEmail) {
      delete validator.newEmail.isDBUnique;
    }
  }

  if (req.body.newPassword) {
    validator = NEW_PASSWORD_VALIDATOR;
  }

  req.checkBody(validator);

  if (req.body.newEmail) {
    req.checkBody('confirmNewEmail', 'Emails do not match').equals(req.body.newEmail);
  }

  if (req.body.newPassword) {
    req.checkBody('confirmNewPassword', 'Passwords do not match')
        .equals(req.body.newPassword);
  }

  req
  .asyncValidationErrors(true)
  .then(() => {
    const where = { id: req.locals.user.get('id') };

    return db.User.findOne({ where })
    .then((patient) => {
      if (!patient) return next(new UnauthorizedError());
      patient.set('email', req.body.newEmail);

      return new Promise((resolve, reject) => {
        if (!req.body.newPassword) return resolve(patient);

        return patient.setPassword(req.body.newPassword, (err, user) => {
          if (err) return reject(err);
          return resolve(user);
        });
      });
    })
    .then(patient => patient.save())
    .then(() => res.json({}))
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
 * Gets the payment details for a specific card
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function getPaymentSource(req, res, next) {
  req.locals.user.getPaymentProfile()
  .then((profile) => {
    if (req.params.token) return stripe.getPaymentMethod(profile.stripeCustomerId, req.params.token);
    return stripe.getPaymentMethods(profile.stripeCustomerId);
  })
  .then((resp) => {
    let data = (req.params.token) ? [resp] : resp.data;
    // Clean the cards objects
    data = data.map(c => _(c).omit(CARD_EXCLUDE_FIELDS_LIST));
    res.json({ data });
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Add a new payment source for the user. Limited to only
 * the primary account holder or associated dentist record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function addPaymentSource(req, res, next) {
  stripe.addPaymentSource(
    req.locals.paymentProfile.stripeCustomerId,
    req.params.token,
  ).then((card) => {
    stripe.setDefaultPaymentSource(
      req.locals.paymentProfile.stripeCustomerId,
      card.id
    ).then(customer => {
      return res.json(customer);
    });
  }).catch(err => next(new BadRequestError(err)));
}

function addPaymentSourceAndSubscribe(req, res) {
  subscribeUserAndMembers(req, res).then(data => {
    res.status(200).send({});  
  }, err => {
    res.status(400).send(err);
  });
}

/**
 * Sets the user's default payment option
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function setDefaultPaymentSource(req, res, next) {
  stripe.setDefaultPaymentSource(
    req.locals.paymentProfile.stripeCustomerId,
    req.params.token,
  ).then((customer) => {
    res.json(customer);
  }).catch(err => next(new BadRequestError(err)));
}

/**
 * Add payment source
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function deletePaymentSource(req, res, next) {
  stripe.deletePaymentSource(
    req.locals.paymentProfile.stripeCustomerId,
    req.params.token,
  )
  .then(() => res.json({}))
  .catch(err => next(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getUser)
  .put(
    verifyPasswordLocal,
    updateUser)
  .delete(deleteUser);

router
  .route('/change-auth')
  .put(
    verifyPasswordLocal,
    updateAuth);

router
  .route('/patients/:patientId')
  .put(
    validateBody(PATIENT_EDIT),
    updatePatient);

router
  .route('/verify-password')
  .post(
    verifyPasswordLocal,
    verifyPassword);

router
  .route('/payment/sources/:token')
  .get(getPaymentSource)
  .post(validateParams(STRIPE_TOKEN), validatePaymentManager(), addPaymentSource)
  .delete(validateParams(STRIPE_TOKEN), validatePaymentManager(), deletePaymentSource);

router
  .route('/payment/sources/:token/default')
  .put(validateParams(STRIPE_TOKEN), validatePaymentManager(), setDefaultPaymentSource);

router
  .route('/payment/subscribe')
  .post(validatePaymentManager(), addPaymentSourceAndSubscribe);
export default router;
