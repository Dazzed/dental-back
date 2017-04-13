import { Router } from 'express';
import passport from 'passport';
import moment from 'moment';
import isPlainObject from 'is-plain-object';
import _ from 'lodash';

import db from '../../models';

import {
  CONTACT_SUPPORT_EMAIL,
  EMAIL_SUBJECTS,
} from '../../config/constants';

import {
  REVIEW,
  INVITE_PATIENT,
  CONTACT_SUPPORT,
  WAIVE_CANCELLATION
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


function waiveCancellationFee(req, res, next) {
  req.checkBody(WAIVE_CANCELLATION);

  req
    .asyncValidationErrors(true)
    .then(() => {
      const userId = req.params.patientId;
      return db.Subscription.findOne({
        where: {
          clientId: userId,
          dentistId: req.user.get('id')
        },
        include: [{
          model: db.User,
          as: 'client'
        }]
      })
      .then(subscription => {
        if (!subscription || !subscription.client) throw new NotFoundError();
        return subscription.get('client');
      });
    })
    .then((user) => {
      const body = _.pick(req.body, ['cancellationFee', 'reEnrollmentFee']);
      return user.update(body);
    })
    .then((user) => res.json({ data: user.toJSON() }))
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
}


router
  .route('/review')
  .post(
    passport.authenticate('jwt', { session: false }),
    addReview);

router
  .route('/review/:reviewId')
  .put(
    passport.authenticate('jwt', { session: false }),
    updateReview)
  .delete(
    passport.authenticate('jwt', { session: false }),
    deleteReview);

router
  .route('/patients/:patientId/waive-fees')
  .put(
    passport.authenticate('jwt', { session: false }),
    waiveCancellationFee);

router
  .route('/invite_patient')
  .post(
    passport.authenticate('jwt', { session: false }),
    invitePatient);

router
  .route('/contact_support')
  .post(contactSupportNoAuth);

export default router;
