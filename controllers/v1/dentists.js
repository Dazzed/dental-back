import { Router } from 'express';
import passport from 'passport';

import db from '../../models';

import {
  CONTACT_SUPPORT_EMAIL,
  EMAIL_SUBJECTS,
} from '../../config/constants';

import {
  REVIEW,
  INVITE_PATIENT,
  CONTACT_SUPPORT,
} from '../../utils/schema-validators';

import {
  BadRequestError,
} from '../errors';


const router = new Router({ mergeParams: true });


function addReview(req, res, next) {
  req.checkBody(REVIEW);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

  db.Review.create({
    title: req.body.title,
    message: req.body.review,
    rating: req.body.rating,
    isAnonymous: req.body.isAnonymous,
    clientId: req.user.get('id'),
    dentistId: req.params.userId,
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
    subject: EMAIL_SUBJECTS.contact_support,
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

router
  .route('/review')
  .post(
    passport.authenticate('jwt', { session: false }),
    addReview);

router
  .route('/invite_patient')
  .post(
    passport.authenticate('jwt', { session: false }),
    invitePatient);

router
  .route('/contact_support')
  .post(
    passport.authenticate('jwt', { session: false }),
    contactSupport);

export default router;
