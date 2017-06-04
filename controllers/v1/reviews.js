import { Router } from 'express';
import passport from 'passport';

import db from '../../models';
import {
  adminRequired,
} from '../middlewares';

import {
  NotFoundError
} from '../errors';


const router = new Router({ mergeParams: true });


/**
 * Gets all reviews related to the dentist whose ID is set in params.
 */
function getReviews(req, res, next) {
  const dentistId = req.params.dentistId;

  db.User.find({
    where: {
      id: dentistId,
      type: 'dentist'
    },
    include: [{
      model: db.Review,
      as: 'dentistReviews',
      attributes: {
        exclude: ['clientId', 'dentistId', 'updatedAt']
      },
      include: [{
        model: db.User,
        as: 'client',
        attributes: {
          include: ['firstName', 'lastName']
        }
      }]
    }]
  })
  .then(user => {
    res.json({ data: user.get('dentistReviews') });
  })
  .catch(next);
}


/**
 * Deletes a review by id.
 */
function deleteReview(req, res, next) {
  db.Review.destroy({
    where: {
      id: req.params.reviewId,
      dentistId: req.params.dentistId
    }
  })
  .then(review => {
    if (!review) {
      throw new NotFoundError('The review was not found.');
    }

    res.json({});
  })
  .catch(next);
}


router
  .route('/')
  .get(
    passport.authenticate('jwt', { session: false }),
    adminRequired,
    getReviews);

router
  .route('/:reviewId')
  .delete(
    passport.authenticate('jwt', { session: false }),
    adminRequired,
    deleteReview);


export default router;
