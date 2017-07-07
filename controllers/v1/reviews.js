// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';
import {
  userRequired,
  adminRequired,
  validateBody,
} from '../middlewares';

import {
  BadRequestError,
  NotFoundError,
} from '../errors';

import {
  REVIEW,
} from '../../utils/schema-validators';

import {
  EMAIL_SUBJECTS
} from '../../config/constants';

import { mailer } from '../../services/mailer';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets all related reviews for the associated dentist
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
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
  .then((user) => {
    res.json({ data: user.get('dentistReviews') });
  })
  .catch(err => next(new BadRequestError(err)));
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
  .then((review) => {
    if (!review) {
      throw new NotFoundError('The review was not found.');
    }

    res.json({});
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Adds a review
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - next middleware function
 */
async function addReview(req, res) {
  const added = await db.Review.create({
    title: req.body.title || '',
    message: req.body.message,
    rating: req.body.rating,
    isAnonymous: req.body.isAnonymous,
    clientId: req.user.get('id'),
    dentistId: req.params.dentistId,
  });

  // get the dentist user from the database.
  await db.User.findById(req.params.dentistId).then((dentist) => {
    // Disable email sending for now.
    // TODO: Send email to dentist when a review is posted.

    // if (dentist) {
    //   // send new review email notification to dentist.
    //   mailer.sendEmail(res.mailer, {
    //     template: 'dentists/new_review',
    //     subject: EMAIL_SUBJECTS.dentist.new_review,
    //     user: dentist
    //   }, {
    //     emailBody: dentistMessages.new_review.body
    //   });
    //
    //   // create a new notification for the dentist about new review.
    //   dentist.createNotification({
    //     title: dentistMessages.new_review.title,
    //     body: dentistMessages.new_review.body
    //   });
    // }
  });

  res.json(added);
}

/**
 * Updates a review
 *
 * @param {Object} req - express request
 * @param {Object} res - express response
 * @param {Function} next - the express next request handler
 */
function updateReview(req, res, next) {
  db.Review.find({
    where: {
      id: req.params.reviewId,
      clientId: req.user.get('id')
    }
  })
  .then((review) => {
    if (!review) res.json(new NotFoundError());

    else {
      review.update({
        title: req.body.title || '',
        message: req.body.message,
        rating: req.body.rating,
        isAnonymous: req.body.isAnonymous
      });

      return res.json({});
    }
  })
  .catch(errs => next(new BadRequestError(errs)));
}


// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    userRequired,
    getReviews);

router
  .route('/review')
  .post(
    userRequired,
    validateBody(REVIEW),
    addReview);

router
  .route('/review/:reviewId')
  .put(
    userRequired,
    validateBody(REVIEW),
    updateReview)
  .delete(
    userRequired,
    deleteReview);

export default router;
