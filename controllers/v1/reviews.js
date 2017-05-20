// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';
import {
  userRequired,
  adminRequired,
} from '../middlewares';

import {
  NotFoundError
} from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets all related reviews for the associated dentist
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
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
 * Deletes a review by id
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
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

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    userRequired,
    adminRequired,
    getReviews);

router
  .route('/:reviewId')
  .delete(
    userRequired,
    adminRequired,
    deleteReview);

export default router;
