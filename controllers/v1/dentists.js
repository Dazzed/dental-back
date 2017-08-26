/* eslint consistent-return:0, no-else-return: 0, max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import moment from 'moment';
import _ from 'lodash';

import {
  userRequired,
  dentistRequired,
  injectSubscribedPatient,
  adminRequired,
  validateBody,
} from '../middlewares';

import db from '../../models';

import stripe from '../stripe';

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
  UPDATE_DENTIST,
  INVITE_PATIENT,
  CONTACT_SUPPORT,
  PATIENT_CARD_UPDATE,
} from '../../utils/schema-validators';

import {
  BadRequestError,
  NotFoundError
} from '../errors';

import { instance as UserInstance } from '../../orm-methods/users';

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
  }, (err) => {
    if (err) {
      next(new BadRequestError({}));
    } else {
      res.json({});
    }
  });
}

/**
 * Contacts support without being logged in
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 */
function contactSupportNoAuth(req, res) {
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
      res.json(new BadRequestError({}));
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(info);
    }

    res.json({});
  });
}

/**
 * Updates a Patient Card
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 */
function updatePatientCard(req, res) {
  let patient = req.locals.client;
  // let dentist = req.user;

  patient.getPaymentProfile()
  .then((paymentProfile) => {
    if(!paymentProfile.primaryAccountHolder) {
      return res.json(new BadRequestError('Cannot update the card of a non-primary account holder patient.'));
    }

    return stripe.updateCustomer(paymentProfile.stripeCustomerId, {
      source: req.body.stripeToken
    })
    .then(() => {
      let patientUpdate = _.pick(req.body, [
        'periodontalDiseaseWaiver',
        'cancellationFeeWaiver',
        'reEnrollmentFeeWaiver',
        'termsAndConditions'
      ]);

      if(!patient.get('waiverCreatedAt')) {
        patientUpdate.waiverCreatedAt = new Date();
      }

      patient.update(patientUpdate)
      .then(() => {
        return res.json({ data : patient.get({plain: true}) });
      });
    });
  });
}

/**
 * Gets a dentist record without authorization
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - the express next request handler
 */
function getDentistNoAuth(req, res, next) {
  db.User.findOne({
    attributes: ['id'],
    where: {
      id: req.params.dentistId,
      type: 'dentist',
    },
  })
  .then((user) => {
    if (user) return user.getFullDentist();
    return null;
  })
  .then((user) => {
    delete user.dentistInfo.priceCodes;
    delete user.dentistInfo.activeMemberCount;
    let data = user || {};
    data = {
      ...data,
      stripe_public_key: process.env.STRIPE_PUBLIC_KEY
    };
    res.json({ data });
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Lists all dentists in DentalHQ
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - the express next request handler
 */
function listDentists(req, res, next) {
  db.User.findAll({ where: { type: 'dentist' } })
  .then(dentists => Promise.all(dentists.map(d => d.getFullDentist())))
  .then((dentists) => {
    // dentists = dentists.map(d => _(d).omit(['email', 'priceCodes', 'activeMemberCount']));
    res.json({ data: dentists });
  })
  .catch(err => next(new BadRequestError(err)));
}

function getDentist(req, res, next) {
  db.User.findOne({ where: { id: req.params.dentistId, type: 'dentist' } })
  .then(d => d.getFullDentist())
  .then((d) => {
    d = _(d).omit(['email', 'priceCodes', 'activeMemberCount']);
    res.json({ data: d });
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Updates a single dentist user
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
async function updateDentist(req, res, next) {
  try {
    const id = req.params.dentistId;
    const data = req.body;

    console.log("I GOT DATA",data)
    if (!id) {
      return res.status(400).send({ errors: 'Invalid Dentist' });
    }
    const dentist = await db.User.findOne({
      where: {
        id
      },
      include: [
        {
          model: db.Phone,
          as: 'phoneNumbers'
        },
        {
          model: db.DentistInfo,
          as: 'dentistInfo'
        }
      ]
    });
    if (!dentist) {
      return res.status(400).send({ errors: 'Invalid Dentist' });
    } else if (data.email !== dentist.email) {
      const isEmailAlreadyInUse = await db.User.find({ where: { email: data.email } });
      if (isEmailAlreadyInUse) {
        return res.status(400).send({ errors: 'Email is Already in use.' });
      }
    }
    if (data.firstName !== dentist.firstName ||
        data.lastName !== dentist.lastName ||
        data.email !== dentist.email ||
        data.verified !== dentist.verified
       ) {
          await db.User.update({
            ...data
          },{
            where: {
              id
            }
          });
    }

    if (data.phone !== dentist.phoneNumbers[0].number) {
      await db.Phone.update({
        number: data.phone
      },{
        where: {
          userId: id
        }
      });
    }

    if (
      data.affordabilityScore !== dentist.dentistInfo.affordabilityScore ||
      data.marketplaceOptIn !== dentist.dentistInfo.marketplaceOptIn ||
      data.managerId !== dentist.dentistInfo.managerId
    ) {
      await db.DentistInfo.update({
        ...data
      }, {
        where: {
          id: dentist.dentistInfo.id
        }
      });
    }

    const updatedDentist = await UserInstance.getFullDentist(id);
    return res.status(200).send(updatedDentist);
    console.log(dentist);
  } catch (e) {
    console.log(e);
    return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).send({});
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// ROUTES

const router = new Router({ mergeParams: true });

router
  .route('/patients/:patientId/update-card')
  .put(
    userRequired,
    dentistRequired,
    validateBody(PATIENT_CARD_UPDATE),
    injectSubscribedPatient(),
    updatePatientCard);

router
  .route('/details/:dentistId/no-auth')
  .get(getDentistNoAuth);

router
  .route('/invite_patient')
  .post(
    userRequired,
    validateBody(INVITE_PATIENT),
    invitePatient);

router
  .route('/contact_support')
  .post(
    validateBody(CONTACT_SUPPORT_NO_AUTH),
    contactSupportNoAuth);

router
  .route('/')
  .get(listDentists);

router
  .route('/:dentistId')
  .get(getDentist)
  .patch(
    userRequired,
    adminRequired,
    validateBody(UPDATE_DENTIST),
    updateDentist);

export default router;
