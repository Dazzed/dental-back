/* eslint consistent-return:0, no-else-return: 0, max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import moment from 'moment';
import isPlainObject from 'is-plain-object';
import _ from 'lodash';

import {
  ensureCreditCard
} from '../payments';

import { fetchDentist } from '../../orm-methods/dentists';

import {
  userRequired,
  adminRequired,
  injectSubscribedPatient,
  validateBody,
} from '../middlewares';

import db from '../../models';
import { mailer } from '../../services/mailer';

import {
  dentistMessages
} from '../../config/messages';

import {
  CONTACT_SUPPORT_EMAIL,
  EDIT_USER_BY_ADMIN,
  EMAIL_SUBJECTS
} from '../../config/constants';

import {
  REVIEW,
  INVITE_PATIENT,
  CONTACT_SUPPORT,
  WAIVE_CANCELLATION,
  PATIENT_CARD_UPDATE,
  UPDATE_DENTIST,
} from '../../utils/schema-validators';

import {
  BadRequestError,
  NotFoundError
} from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// HELPERS

const CONTACT_SUPPORT_NO_AUTH = (
  Object.assign({
    name: { notEmpty: true },
    email: { notEmpty: true, isEmail: true }
  }, CONTACT_SUPPORT)
);

// ────────────────────────────────────────────────────────────────────────────────

/** Gets time in pacific standard time */
function getDateTimeInPST() {
  const now = moment();
  const time = now.format('h:mm a');
  const date = now.format('M/D/YY');

  return `${time} on ${date}`;
}

/**
 * Obtains the details of one or several dentists
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
function listDentists(req, res, next) {
  if (req.params.userId) {
    // Fetch specific dentist info
    fetchDentist(req.params.userId)
    .then(dentist => res.json({ data: [dentist] }))
    .catch(err => next(new BadRequestError(err)));
  } else {
    // Get all dentist info
    db.User.findAll({
      where: { type: 'dentist' },
      attributes: ['id'],
    })
    .then(users => {
      Promise.all(users.map(u => fetchDentist(u.id)))
      .then(dentists => res.json({ data: dentists }))
      .catch(err => {
        console.error(err);
        next(new BadRequestError(err));
      });
    })
    .catch(err => {
      console.error(err);
      next(new BadRequestError(err));
    });
  }
}

/**
 * Adds a review
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
function addReview(req, res) {
  db.Review.create({
    title: req.body.title || '',
    message: req.body.message,
    rating: req.body.rating,
    isAnonymous: req.body.isAnonymous,
    clientId: req.user.get('id'),
    dentistId: req.params.userId,
  });

  // get the dentist user from the database.
  db.User.findById(req.params.userId).then(dentist => {
    if (dentist) {
      // send new review email notification to dentist.
      mailer.sendEmail(res.mailer, {
        template: 'dentists/new_review',
        subject: EMAIL_SUBJECTS.dentist.new_review,
        user: dentist
      }, {
        emailBody: dentistMessages.new_review.body
      });

      // create a new notification for the dentist about new review.
      dentist.createNotification({
        title: dentistMessages.new_review.title,
        body: dentistMessages.new_review.body
      });
    }
  });

  return res.json({});
}

/**
 * Updates a review
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
function updateReview(req, res, next) {
  return db.Review.find({
    where: {
      id: req.params.reviewId,
      clientId: req.user.get('id')
    }
  })
  .then(review => {
    if (!review) return next(new NotFoundError());

    review.update({
      title: req.body.title || '',
      message: req.body.message,
      rating: req.body.rating,
      isAnonymous: req.body.isAnonymous
    });

    return res.json({});
  })
  .catch(errs => next(new BadRequestError(errs)));
}

/**
 * Deletes a dentist office review
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
function deleteReview(req, res) {
  db.Review.destroy({
    where: {
      id: req.params.reviewId,
      clientId: req.user.get('id')
    }
  });

  return res.json({});
}

/**
 * Invites a patient to register with a dentist office
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
function invitePatient(req, res, next) { // eslint-disable-line
  res.mailer.send('auth/dentist/invite_patient', {
    to: req.body.email,
    subject: EMAIL_SUBJECTS.dentist.invite_patient,
    site: process.env.SITE,
    dentist: req.user,
    message: req.body.message,
  }, (err, info) => {
    if (err) {
      console.log(err);
      return next(new BadRequestError({}));
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(info);
    }

    return res.json({});
  });
}

/**
 * Contacts support
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
function contactSupport(req, res, next) { // eslint-disable-line
  res.mailer.send('contact-support/index', {
    to: CONTACT_SUPPORT_EMAIL, // process.env.CONTACT_SUPPORT_EMAIL ??
    replyTo: req.user.get('email'),
    subject: EMAIL_SUBJECTS.contact_support,
    site: process.env.SITE,
    dentist: req.user,
    email: req.user.get('email'),
    time: getDateTimeInPST(),
    message: req.body.message,
  }, (err, info) => {
    if (err) {
      console.log(err);
      return next(new BadRequestError({}));
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(info);
    }

    return res.json({});
  });
}

/**
 * Contacts support without being logged in
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
function contactSupportNoAuth(req, res, next) {
  res.mailer.send('contact-support/index', {
    to: CONTACT_SUPPORT_EMAIL, // process.env.CONTACT_SUPPORT_EMAIL ??
    replyTo: req.body.email,
    subject: EMAIL_SUBJECTS.contact_support,
    site: process.env.SITE,
    name: req.body.name,
    email: req.body.email,
    time: getDateTimeInPST(),
    message: req.body.message,
  }, (err, info) => {
    if (err) {
      console.log(err);
      return next(new BadRequestError({}));
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(info);
    }

    return res.json({});
  });
}

/**
 * Waives the cancellation fee for a user
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 */
function waiveCancellationFee(req, res) {
  Promise.resolve().then(() => {
    const body = _.pick(req.body, ['cancellationFee', 'reEnrollmentFee']);
    return req.locals.client.update(body);
  })
  .then((user) => res.json({ data: user.toJSON() }));
}


/**
 * Validates a Credit Card
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
function validateCreditCard(req, res, next) {
  // TODO: Validate credit card using Stripe
  ensureCreditCard(req.locals.client, req.body.card)
    .then(user => {
      req.locals.chargeTo = user;
      return next();
    })
    .catch((errors) => {
      if (isPlainObject(errors.json)) {
        return next(new BadRequestError(errors.json));
      }

      return next(errors);
    });
}

/**
 * Updates a Patient Card
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
function updatePatientCard(req, res, next) {
  Promise.resolve()
  .then(() => {
    const body = _.pick(req.body, [
      'periodontalDiseaseWaiver',
      'cancellationFeeWaiver',
      'reEnrollmentFeeWaiver',
      'termsAndConditions'
    ]);

    if (!req.locals.client.get('waiverCreatedAt')) {
      body.waiverCreatedAt = new Date();
    }

    return req.locals.client.update(body);
  })
  .then(() => {
    const client = req.locals.client.toJSON();
    res.json({ data: client });
  }).catch(err => next(new BadRequestError(err)));
}

/**
 * Updates a single dentist user
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
function updateDentist(req, res, next) {
  if (req.params.userId) {
    // Update the dentist account but only with allowed fields
    (new Promise((resolve, reject) => {
      const body = _.pick(req.body, EDIT_USER_BY_ADMIN);
      if (req.body.phoneNumber) {
        // Update the users phone number as well
        db.Phone.update({ number: req.body.phoneNumber }, {
          where: { userId: req.params.userId },
        })
        .then(() => resolve(body))
        .catch(reject);
      } else {
        resolve(body);
      }
    })).then((body = {}) => {
      // Update the user account
      db.User.update(body, {
        where: { id: req.params.userId, type: 'dentist' },
      })
      .then(() => res.json({ data: { success: true } }))
      .catch(err => next(new BadRequestError(err)));
    }).catch(() => next(new BadRequestError('Failed to update the user')));
  } else {
    next(new BadRequestError('Requested user does not exist'));
  }
}

/**
 * Gets a dentist record without authorization
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
function getDentistNoAuth(req, res, next) {
  db.User.findOne({
    attributes: ['id'],
    where: {
      id: req.params.userId,
      type: 'dentist'
    }
  })
  .then(user => {
    if (user) return user.getFullDentist();
    return null;
  })
  .then(user => {
    delete user.dentistInfo.priceCodes;
    delete user.dentistInfo.activeMemberCount;
    res.json({ data: user || {} });
  })
  .catch(next);
}

// ────────────────────────────────────────────────────────────────────────────────
// ROUTES

const router = new Router({ mergeParams: true });

router
  .route('/:userId/review')
  .post(
    userRequired,
    validateBody(REVIEW),
    addReview);

router
  .route('/:userId/review/:reviewId')
  .put(
    userRequired,
    validateBody(REVIEW),
    updateReview)
  .delete(
    userRequired,
    deleteReview);

router
  .route('/:userId/patients/:patientId/waive-fees')
  .put(
    userRequired,
    injectSubscribedPatient(),
    validateBody(WAIVE_CANCELLATION),
    waiveCancellationFee);

router
  .route('/:userId/patients/:patientId/update-card')
  .put(
    userRequired,
    validateBody(PATIENT_CARD_UPDATE),
    injectSubscribedPatient(),
    validateCreditCard,
    updatePatientCard);

router
  .route('/:userId/no-auth')
  .get(getDentistNoAuth);

router
  .route('/:userId/invite_patient')
  .post(
    userRequired,
    validateBody(INVITE_PATIENT),
    invitePatient);

router
  .route('/:userId/contact_support')
  .post(
    validateBody(CONTACT_SUPPORT_NO_AUTH),
    contactSupportNoAuth);

router
  .route('/:userId?/:phoneId?')
  .get(
    userRequired,
    adminRequired,
    listDentists)
  .put(
    userRequired,
    adminRequired,
    validateBody(UPDATE_DENTIST),
    updateDentist);

export default router;
