/* eslint consistent-return:0, no-else-return: 0, max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import moment from 'moment-timezone';
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
import Mailer from '../mailer';

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

import { processDiff } from '../../utils/compareUtils';
// ────────────────────────────────────────────────────────────────────────────────
// HELPERS

const CONTACT_SUPPORT_NO_AUTH = (
  Object.assign({
    name: { notEmpty: true },
    email: { notEmpty: true, isEmail: true }
  }, CONTACT_SUPPORT)
);

// ────────────────────────────────────────────────────────────────────────────────

/** Gets time in eastern standard time */
function getDateTimeInEST() {
  const now = moment().tz('America/New_York');
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
    time: getDateTimeInEST(),
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
async function listDentists(req, res, next) {
  try {
    const dentists = await db.User.findAll({ where: { type: 'dentist' } });
    let fullDentists = await Promise.all(dentists.map(d => d.getFullDentist()));
    for (const [i,dentist] of fullDentists.entries()) {
      fullDentists[i].links = await db.User.findAll({
        attributes: ['id'],
        where: {
          type: 'dentist',
          linkedWith: dentist.linkedWith,
          id: {
            $ne: dentist.id
          }
        }
      }).map(d => {
        return { 
          id: d.id,
          officeName: fullDentists.find(f => f.id === d.id).dentistInfo.officeName,
        };
      });

      const { managerId } = dentist.dentistInfo;
      fullDentists[i].dentistInfo.manager = await db.User.findOne({
        where: {
          id: managerId
        },
        attributes: ['firstName', 'lastName', 'email']
      });
    }
    // fullDentists = fullDentists.map(d => _(d).omit(['email', 'priceCodes', 'activeMemberCount']));
    return res.json({ data: fullDentists });
  } catch(e) {
    console.log("Error in listDentists");
    console.log(e);
    return res.status(500).send({ errors: "Internal Server Error" });
  }
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

    if (data.verified !== dentist.verified && data.verified === true) {
      Mailer.activationCompleteEmail(res, dentist);
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

    // marketplaceOptIn is inverted logic in the FE.
    if (
      data.affordabilityScore !== dentist.dentistInfo.affordabilityScore ||
      !data.marketplaceOptIn !== dentist.dentistInfo.marketplaceOptIn ||
      data.managerId !== dentist.dentistInfo.managerId
    ) {
      await db.DentistInfo.update({
        ...data,
        marketplaceOptIn: !data.marketplaceOptIn
      }, {
        where: {
          id: dentist.dentistInfo.id
        }
      });
    }

    const links = data.links.map(l => l.id);
    const alteredLinks = data.alteredLinks.map(l => l.id);
    const linkingDiff = processDiff(links, alteredLinks);
    if (!linkingDiff.isSame) {
      const { addedItems, removedItems } = linkingDiff;

      if (addedItems.length > 0) {
        for (const item of addedItems) {
          const addedDentist = await db.User.findOne({ where: { id: parseInt(item) } });
          addedDentist.linkedWith = dentist.id;
          await addedDentist.save();
          const addedDentistLinks = await db.User.findAll({ where: { linkedWith: addedDentist.id } });
          for (const adl of addedDentistLinks) {
            adl.linkedWith = adl.id;
            await adl.save();
          }
        }
      }

      if (removedItems.length > 0) {
        for (const item of removedItems) {
          const removedDentist = await db.User.findOne({ where: { id: parseInt(item) } });
          removedDentist.linkedWith = removedDentist.id;
          await removedDentist.save();
        }
      }
    }

    let updatedDentist = await UserInstance.getFullDentist(id);
    updatedDentist.links = await db.User.findAll({
      attributes: ['id'],
      where: {
        type: 'dentist',
        linkedWith: {
          $or: [updatedDentist.id, updatedDentist.linkedWith]
        },
        id: {
          $ne: updatedDentist.id
        }
      },
      include: [{
        model: db.DentistInfo,
        as: 'dentistInfo'
      }]
    }).map(d => {
      return { 
        id: d.id,
        officeName: d.dentistInfo.officeName,
      };
    });
    return res.status(200).send({ updatedDentist, refresh: !linkingDiff.isSame });
  } catch (e) {
    console.log(e);
    return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).send({});
  }
}

async function getLinkedOffices(req, res) {
  try {
    const { officeSlug } = req.params;
    if (!officeSlug) {
      return res.status(400).send({ errors: "Invalid office name" });
    }
    console.log(officeSlug)
    const dentistInfo = await db.DentistInfo.findOne({
      where: {
        officeSlug
      },
      include: [{
        model: db.User,
        as: 'user'
      }]
    });
    if (!dentistInfo) {
      console.log("Error in getLinkedOffices, No matching slugs found for " + officeSlug);
      return res.status(400).send({ errors: "Invalid office name" });
    }
    
    const users = await db.User.findAll({
      where: {
        linkedWith: dentistInfo.user.linkedWith,
      }
    }).map(u => u.toJSON());

    const offices = await db.DentistInfo.findAll({ where: { userId: users.map(u => u.id) } })
      .map(d => d.toJSON());
    return res.status(200).send({ offices });
  } catch (e) {
    console.log("Error in getLinkedOffices");
    console.log(e);
    return res.status(500).send({ errors: "Internal Server Error" });
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
    .route('/get_linked_offices/:officeSlug')
    .get(getLinkedOffices);

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
