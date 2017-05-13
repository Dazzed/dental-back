/* eslint consistent-return:0, no-else-return: 0 */
import { Router } from 'express';
import passport from 'passport';
import moment from 'moment';
import isPlainObject from 'is-plain-object';
import _ from 'lodash';

import {
  ensureCreditCard
} from '../payments';

import {
  instance as UserInstance,
} from '../../orm-methods/users';

import { MembershipMethods } from '../../orm-methods/memberships';

import {
  userRequired,
  adminRequired,
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


const router = new Router({ mergeParams: true });


function getDateTimeInPST() {
  const now = moment();
  const time = now.format('h:mm a');
  const date = now.format('M/D/YY');

  return `${time} on ${date}`;
}

/**
 * Prepares a promise for fetching a dentist's information
 *
 * @param {object} req - the express request object
 * @param {object} res - the express response object
 * @param {function} next - the next web action to be triggered
 * @return {Promise<Dentist>}
 */
function fetchDentist(userId) {
  return new Promise((resolve, reject) => {
    UserInstance.getFullDentist(userId)
    .then(d => {
      d = d.toJSON();
      // Retrieve Price Codes
      db.MembershipItem.findAll({
        where: { dentistInfoId: d.dentistInfo.id },
        include: [{
          model: db.PriceCodes,
          as: 'priceCode'
        }]
      }).then(items => {
        d.dentistInfo.priceCodes = items.map(i => {
          const temp = i.priceCode.toJSON();
          temp.price = i.get('price');
          return i.priceCode;
        });
        // Calculate membership costs
        MembershipMethods
        .calculateCosts(d.dentistInfo.id, [
          d.dentistInfo.membership.id,
          d.dentistInfo.childMembership.id,
        ])
        .then(fullCosts => {
          fullCosts.forEach(cost => {
            if (d.dentistInfo.membership.id === cost.membershipId) {
              d.membership.fullCost = cost.fullCost;
              d.membership.savings = (cost.fullCost - (parseInt(d.membership.price, 10) * 12));
            } else if (d.childMembership.id === cost.membershipId) {
              d.childMembership.fullCost = cost.fullCost;
              d.childMembership.savings = (cost.fullCost - (parseInt(d.childMembership.price, 10) * 12));
            }
          });

          // Retrieve Active Member Count
          db.Subscription.count({
            where: {
              dentistId: d.dentistInfo.id,
              status: 'active',
            }
          }).then(activeMemberCount => {
            d.dentistInfo.activeMemberCount = activeMemberCount;
            resolve(d);
          }).catch(err => { throw new Error(err); });
        });
      }).catch(reject);
    })
    .catch(reject);
  });
}

/**
 * Obtains the details of one or several dentists
 *
 * @param {object} req - the express request object
 * @param {object} res - the express response object
 * @param {function} next - the next web action to be triggered
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
      .catch(err => next(new BadRequestError(err)));
    })
    .catch(err => next(new BadRequestError(err)));
  }
}

function addReview(req, res, next) {
  req.checkBody(REVIEW);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

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


function updateReview(req, res, next) {
  req.checkBody(REVIEW);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

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


function deleteReview(req, res) {
  db.Review.destroy({
    where: {
      id: req.params.reviewId,
      clientId: req.user.get('id')
    }
  });

  return res.json({});
}

function invitePatient(req, res, next) { // eslint-disable-line
  req.checkBody(INVITE_PATIENT);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

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


function contactSupport(req, res, next) { // eslint-disable-line
  req.checkBody(CONTACT_SUPPORT);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

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


function contactSupportNoAuth(req, res, next) { // eslint-disable-line
  req.checkBody(
    Object.assign({
      name: { notEmpty: true },
      email: { notEmpty: true, isEmail: true }
    }, CONTACT_SUPPORT)
  );

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

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


function getSubscribedPatient(req, res, next) {
  db.Subscription.findOne({
    where: {
      clientId: req.params.patientId,
      dentistId: req.user.get('id')
    },
    include: [{
      model: db.User,
      as: 'client',
      attributes: {
        exclude: ['resetPasswordKey', 'salt', 'activationKey', 'verified']
      }
    }]
  })
  .then((subscription) => {
    if (!subscription || !subscription.get('client')) throw new NotFoundError();
    req.locals.client = subscription.get('client');
    return next();
  })
  .catch(next);
}


function waiveCancellationFee(req, res, next) {
  req.checkBody(WAIVE_CANCELLATION);

  req
    .asyncValidationErrors(true)
    .then(() => {
      const body = _.pick(req.body, ['cancellationFee', 'reEnrollmentFee']);
      return req.locals.client.update(body);
    })
    .then((user) => res.json({ data: user.toJSON() }))
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
}


function validateCreditCard(req, res, next) {
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


function updatePatientCard(req, res, next) {
  req.checkBody(PATIENT_CARD_UPDATE);
  // req.checkBody([
  //   'periodontalDiseaseWaiver',
  //   'cancellationFeeWaiver',
  //   'reEnrollmentFeeWaiver',
  //   'termsAndConditions'
  // ], 'Please accept all conditions').equals(true);

  req
    .asyncValidationErrors(true)
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
      // updateCreditCard(req.locals.client.get('id'));
      delete client.authorizeId;
      delete client.paymentId;

      return res.json({ data: client });
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
}

/**
 * Updates a single dentist user
 *
 * @param {object} req - the express request object
 * @param {object} res - the express response object
 * @param {function} next - the next web action to be triggered
 */
function updateDentist(req, res, next) {
  if (req.params.userId) {
    req.checkBody(UPDATE_DENTIST);

    req
    .asyncValidationErrors(true)
    .then(() => {
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
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
  } else {
    next(new BadRequestError('Requested user does not exist'));
  }
}

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

router
  .route('/:userId/review')
  .post(
    userRequired,
    addReview);

router
  .route('/:userId/review/:reviewId')
  .put(
    userRequired,
    updateReview)
  .delete(
    userRequired,
    deleteReview);

router
  .route('/:userId/patients/:patientId/waive-fees')
  .put(
    userRequired,
    getSubscribedPatient,
    waiveCancellationFee);

router
  .route('/:userId/patients/:patientId/update-card')
  .put(
    userRequired,
    getSubscribedPatient,
    validateCreditCard,
    updatePatientCard);

router
  .route('/:userId/no-auth')
  .get(getDentistNoAuth);

router
  .route('/:userId/invite_patient')
  .post(
    userRequired,
    invitePatient);

router
  .route('/:userId/contact_support')
  .post(contactSupportNoAuth);

router
  .route('/:userId?/:phoneId?')
  .get(
    userRequired,
    adminRequired,
    listDentists)
  .put(
    userRequired,
    adminRequired,
    updateDentist);

module.exports = {
  dentists: router,
  listDentists,
  updateDentist,
};
