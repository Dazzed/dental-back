import { Router } from 'express';
import passport from 'passport';
import isPlainObject from 'is-plain-object';
import HTTPStatus from 'http-status';
//import aws from 'aws-sdk';
//import multer from 'multer';
//import multerS3 from 'multer-s3';
import _ from 'lodash';

import db from '../../models';
import { EXCLUDE_FIELDS_LIST } from '../../models/user';
import {
  getCreditCardInfo,
  ensureCreditCard
} from '../payments';

import {
  NORMAL_USER_EDIT,
  PATIENT_EDIT,
  NEW_EMAIL_VALIDATOR,
  NEW_PASSWORD_VALIDATOR
} from '../../utils/schema-validators';

import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError
} from '../errors';


const router = new Router();

/**
 * Fill req.locals.user with the requested used on url params and
 * call next middleware if allowed.
 *
 */
export function getUserFromParam(req, res, next) {
  const userId = req.params.userId;

  if (userId === 'me' ||
      (req.user && req.user.get('id') === parseInt(userId, 10))) {
    req.locals.user = req.user;
    return next();
  }

  if (req.user && req.user.get('type') === 'client' && userId === 'me') {
    return next(new ForbiddenError());
  }

  let accountOwner;

  if (req.user && req.user.get('type') === 'client') {
    accountOwner = req.user.get('id');
  }

  return db.User.getActiveUser(userId, accountOwner).then((user) => {
    if (!user) {
      return next(new NotFoundError());
    }

    req.locals.user = user;
    return next();
  }).catch((error) => {
    next(error);
  });
}


function verifyPasswordLocal(req, res, next) {
  // req.checkBody({ oldPassword: { nonEmpty: true } });
  // const errors = req.asyncValidationErrors(true)
  //
  // if (errors) {
  // }

  db.User.find({
    where: { id: req.locals.user.get('id') }
  })
  .then(_user => {
    const password = req.body.oldPassword;

    _user.authenticate(password, (err, user) => {
      if (err) return next(err);

      if (!user) {
        return next(new UnauthorizedError('Incorrect password.'));
      }
      req.locals.passwordVerified = true;
      return next();
    });
  });
}


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


function deleteUser(req, res) {
  const delEmail = `DELETED_${req.locals.user.email}`;
  req.locals.user.update({ email: delEmail, isDeleted: true }).then(() => res.json({}));
}


// TODO: maybe later add avatar support?? or another endpoint
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


function updatePatient(req, res, next) {
  req.checkBody(PATIENT_EDIT);

  req
    .asyncValidationErrors(true)
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


function getCardInfo(req, res, next) {
  const queries = [
    db.Subscription.getPendingAmount(req.locals.user.get('id')),
  ];

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

/*
aws.config.update({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_ACCESS_KEY,
  region: process.env.S3_REGION,
});
const s3 = new aws.S3();
const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.S3_BUCKET || 'dentalmarket',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    acl: 'public-read',
    metadata(_req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key(_req, file, cb) {
      cb(null, `${new Date().getTime()}.jpg`);
    },
  }),
});
*/

/*
function createS3Bucket(req, res, next) {
  s3.createBucket({ Bucket: process.env.S3_BUCKET }, (err) => {
    if (err) next(err);
    else next();
  });
}
*/

/*
function signS3Upload(req, res) {
  const files = req.files.map(file => _.omit(file,
    ['metadata', 'storageClass', 'acl', 'etag',
      'bucket', 'fieldname', 'encoding', 'contentDisposition']));
  res.json({ data: files });
}
*/


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


function verifyPassword(req, res) {
  res.json({ passwordVerified: req.locals.passwordVerified });
}


function makePayment(req, res, next) {
  ensureCreditCard(req.locals.user, req.body.card)
    .then(user => res.json({
      data: _.omit(user, ['authorizeId', 'paymentId'])
    }))
    .catch(error => next(error));
}


router
  .route('/:userId')
  .get(
    passport.authenticate('jwt', { session: false }),
    getUserFromParam,
    getUser)
  .delete(
    passport.authenticate('jwt', { session: false }),
    getUserFromParam,
    deleteUser)
  .put(
    passport.authenticate('jwt', { session: false }),
    getUserFromParam,
    verifyPasswordLocal,
    updateUser);

router
  .route('/:userId/change-auth')
  .put(
    passport.authenticate('jwt', { session: false }),
    getUserFromParam,
    verifyPasswordLocal,
    updateAuth);

router
  .route('/:userId/patients/:patientId')
  .put(
    passport.authenticate('jwt', { session: false }),
    getUserFromParam,
    updatePatient);

/*
router
  .route('/upload-photos')
  .post(
    createS3Bucket,
    upload.array('photos', 10),
    signS3Upload);
*/

router
  .route('/:userId/verify-password')
  .post(
    passport.authenticate('jwt', { session: false }),
    getUserFromParam,
    verifyPasswordLocal,
    verifyPassword);

router
  .route('/:userId/credit-card')
  .get(
    passport.authenticate('jwt', { session: false }),
    getUserFromParam,
    getCardInfo);

router
  .route('/:userId/payments')
  .post(
    getUserFromParam,
    makePayment);


export default router;
