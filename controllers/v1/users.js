// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import isPlainObject from 'is-plain-object';
import HTTPStatus from 'http-status';
import _ from 'lodash';

import db from '../../models';
import { EXCLUDE_FIELDS_LIST } from '../../models/user';
import {
  getCreditCardInfo,
  ensureCreditCard,
  chargeAuthorize
} from '../payments';

import {
  NORMAL_USER_EDIT,
  PATIENT_EDIT,
  NEW_EMAIL_VALIDATOR,
  NEW_PASSWORD_VALIDATOR
} from '../../utils/schema-validators';

import {
  EMAIL_SUBJECTS
} from '../../config/constants';

import {
  dentistMessages,
  patientMessages
} from '../../config/messages';

import {
  userRequired,
  injectUser,
  verifyPasswordLocal,
  validateBody,
} from '../middlewares';

import { mailer } from '../../services/mailer';

import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError
} from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a user account record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function getUser(req, res, next) {
  if (req.user.get('type') === 'dentist') {
    return req.locals.user
      .getDentistReviews()
      .then(dentistReviews => {
        // add all the review ratings.
        const totalRating = _.sumBy(
          dentistReviews, review => review.rating);

        const user = req.locals.user.toJSON();
        // average the ratings.
        user.rating = totalRating / dentistReviews.length;
        // dentistReviews
        //   .forEach(review => {
        //     delete review.clientId;
        //     delete review.dentistId;
        //   });
        // user.reviews = dentistReviews;

        delete user.memberships;
        return res.json({ data: user });
      })
      .catch(next);
  }

  return req.locals.user
    .getCurrentSubscription()
    .then(subscription => {
      const user = req.locals.user.toJSON();
      user.subscription = subscription;

      return res.json({ data: user });
    })
    .catch(next);
}

/**
 * Deletes a user account record (soft delete)
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function deleteUser(req, res) {
  const delEmail = `DELETED_${req.locals.user.email}`;
  req.locals.user.update({ email: delEmail, isDeleted: true }).then(() => res.json({}));
}


// TODO: maybe later add avatar support?? or another endpoint
/**
 * Updates a user record account
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function updateUser(req, res, next) {
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

    // NOTE: This should later removed to add and remove by others endpoints
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

    return next(errors);
  });
}

/**
 * Updates a patient account record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
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
    .then(patient => {
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
    .catch(next);
  })
  .catch(errors => {
    if (isPlainObject(errors)) {
      return next(new BadRequestError(errors));
    }

    return next(errors);
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
    .then(patient => {
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
  .catch(errors => {
    if (isPlainObject(errors)) {
      return next(new BadRequestError(errors));
    }

    return next(errors);
  });
}

/**
 * Gets the user account payment card info
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function getCardInfo(req, res, next) {
  // FIXME: Should get card info from Stripe
  const queries = [
    db.Subscription.getPendingAmount(req.locals.user.get('id')),
  ];

  // TODO: Update call to get credit card info
  if (req.locals.user.get('authorizeId') && req.locals.user.get('paymentId')) {
    queries.push(
      getCreditCardInfo(
        req.locals.user.get('authorizeId'),
        req.locals.user.get('paymentId')
      )
    );
  }

  Promise.all(queries).then(([{ data }, info]) => {
    res.json({ data: { info, details: data } });
  }).catch(next);
}

// const aws = require('aws-sdk');
// const multer = require('multer');
// const multerS3 = require('multer-s3');
//
// aws.config.update({
//   accessKeyId: process.env.S3_ACCESS_KEY_ID,
//   secretAccessKey: process.env.S3_ACCESS_KEY,
//   region: process.env.S3_REGION,
// });
// const s3 = new aws.S3();
// const upload = multer({
//   storage: multerS3({
//     s3,
//     bucket: process.env.S3_BUCKET || 'dentalmarket',
//     contentType: multerS3.AUTO_CONTENT_TYPE,
//     acl: 'public-read',
//     metadata(_req, file, cb) {
//       cb(null, { fieldName: file.fieldname });
//     },
//     key(_req, file, cb) {
//       cb(null, `${new Date().getTime()}.jpg`);
//     },
//   }),
// });


// function createS3Bucket(req, res, next) {
//   s3.createBucket({ Bucket: process.env.S3_BUCKET }, (err) => {
//     if (err) next(err);
//     else next();
//   });
// }
//
// function signS3Upload(req, res) {
//   const files = req.files.map(file => _.omit(file,
//     ['metadata', 'storageClass', 'acl', 'etag',
//       'bucket', 'fieldname', 'encoding', 'contentDisposition']));
//   res.json({ data: files });
// }


// function signS3(req, res, next) {
//   const fileName = req.query.file_name;
//   const fileType = req.query.file_type;
//   const key = process.env.S3_ACCESS_KEY;
//
//   const s3Params = {
//     Bucket: process.env.S3_BUCKET,
//     Key: key,
//     Expires: 60,
//     ContentType: fileType,
//     ACL: 'public-read'
//   };
//
//   s3.getSignedUrl('putObject', s3Params, (err, data) => {
//     if (err) {
//       return next(err);
//     }
//     console.log(data);
//
//     const location = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
//     const avatar = {
//       location,
//       type: fileType,
//       originalName: fileName,
//     };
//
//     // req.locals.user.update({ avatar });
//
//     const returnData = {
//       signedRequest: data,
//       avatar,
//     };
//
//     return res.json(returnData);
//   });
// }

/**
 * Verifies a user account password
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function verifyPassword(req, res) {
  res.json({ passwordVerified: req.locals.passwordVerified });
}

/**
 * Submits a request to charge the associated user account record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function makePayment(req, res, next) {
  // FIXME: completely rebuild this functionality using Stripe
  ensureCreditCard(req.locals.user, req.body.card).then(user => {
    db.Subscription.getPendingAmount(user.id).then(data => {
      if (parseInt(data.total, 10) !== 0) {
        chargeAuthorize(user.authorizeId, user.paymentId, data).then(() => {
          req.locals.user.getSubscriptions().then(subscriptions => {
            Promise.all(subscriptions.map(
              subscription => subscription.setActive(true)
            ));
          });

          // send welcome email to patient.
          mailer.sendEmail(res.mailer, {
            template: 'auth/client/welcome',
            subject: EMAIL_SUBJECTS.client.welcome,
            user
          }, {
            emailBody: patientMessages.welcome.body
          });

          // send email to patient's dentist.
          req.locals.user.getMyDentist(true).then(([dentist, rawDentist]) => {
            mailer.sendEmail(res.mailer, {
              template: 'dentists/new_patient',
              subject: EMAIL_SUBJECTS.dentist.new_patient,
              user: dentist
            }, {
              emailBody: dentistMessages.new_patient.body
            });

            // create a new notification for the dentist about new patient.
            rawDentist.createNotification({
              title: dentistMessages.new_patient.title,
              body: dentistMessages.new_patient.body
            });
          });

          // add notification.

          // TODO: keep transaction log and/or implement webhook with Authorize.
          res.json({
            data: _.omit(user, ['authorizeId', 'paymentId'])
          });
        })
        .catch(errors => next(errors));
      } else {
        res.json({
          data: _.omit(user, ['authorizeId', 'paymentId'])
        });
      }
    });
  })
  .catch(errors => next(errors));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/:userId')
  .get(
    userRequired,
    injectUser(),
    getUser)
  .put(
    userRequired,
    injectUser(),
    verifyPasswordLocal,
    updateUser)
  .delete(
    userRequired,
    injectUser(),
    deleteUser);

router
  .route('/:userId/change-auth')
  .put(
    userRequired,
    injectUser(),
    verifyPasswordLocal,
    updateAuth);

router
  .route('/:userId/patients/:patientId')
  .put(
    userRequired,
    validateBody(PATIENT_EDIT),
    injectUser(),
    updatePatient);

router
  .route('/:userId/verify-password')
  .post(
    userRequired,
    injectUser(),
    verifyPasswordLocal,
    verifyPassword);

router
  .route('/:userId/credit-card')
  .get(
    userRequired,
    injectUser(),
    getCardInfo);

router
  .route('/:userId/payments')
  .post(
    userRequired,
    injectUser(),
    makePayment);


export default router;
