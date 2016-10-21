import { Router } from 'express';
import passport from 'passport';

import db from '../../models';

import {
  REVIEW,
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

router
  .route('/review')
  .post(
    passport.authenticate('jwt', { session: false }),
    addReview);


export default router;

