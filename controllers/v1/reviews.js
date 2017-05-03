import { Router } from 'express';
import passport from 'passport';
import _ from 'lodash';

import db from '../../models';
import {
  adminRequired,
} from '../middlewares';

import {
  NotFoundError,
  ForbiddenError,
} from '../errors';


const router = new Router({ mergeParams: true });


/**
 * Fill req.locals.dentistInfo with the requested member on url params,
 * if allowed call next middleware.
 *
 */
function getDentistInfoFromParams(req, res, next) {
  const userId = req.params.userId;

  /*
   * If user is not admin and try to requests paths not related
   * to that user will return forbidden.
   */
  const canEdit =
    userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
    (req.user.get('type') === 'admin' && userId !== 'me');

  if (!canEdit) {
    return next(new ForbiddenError());
  }

  const query = {
    where: {},
    attributes: {
      exclude: ['userId'],
    },
    include: [{
      model: db.WorkingHours,
      as: 'workingHours',
      attributes: { exclude: ['dentistInfoId'] },
      orderBy: 'createdAt DESC',
    }, {
      model: db.MembershipItem,
      as: 'pricing',
      attributes: {
        exclude: ['dentistInfoId']
      }
    }, {
      model: db.Membership,
      as: 'membership',
      attributes: {
        exclude: ['isDeleted', 'default', 'userId'],
      },
      // include: [{
      //   model: db.MembershipItem,
      //   as: 'items',
      //   attributes: {
      //     exclude: ['membershipId'],
      //   },
      // }],
    }, {
      model: db.Membership,
      as: 'childMembership',
      attributes: {
        exclude: ['isDeleted', 'default', 'userId'],
      },
      // include: [{
      //   model: db.MembershipItem,
      //   as: 'items',
      //   attributes: {
      //     exclude: ['membershipId'],
      //   },
      // }],
    }, {
      model: db.DentistInfoService,
      as: 'services',
      attributes: {
        exclude: ['serviceId', 'dentistInfoId']
      },
      include: [{
        model: db.Service,
        as: 'service',
        raw: true
      }]
    }, {
      model: db.DentistInfoPhotos,
      as: 'officeImages',
      attributes: ['url']
    }],
    order: [
      [
        { model: db.Membership, as: 'membership' },
        // { model: db.MembershipItem, as: 'items' },
        'id', 'asc'
      ],
      [
        { model: db.Membership, as: 'childMembership' },
        // { model: db.MembershipItem, as: 'items' },
        'id', 'asc'
      ]
    ]
  };

  if (req.params.dentistInfoId) {
    query.where.id = req.params.dentistInfoId;
  }

  // if not admin limit query to related data userId
  if (req.user.get('type') !== 'admin') {
    query.where.userId = req.user.get('id');
  }

  // console.log(query);
  return db.DentistInfo.find(query).then((dentistInfo) => {
    if (!dentistInfo) {
      return next(new NotFoundError());
    }

    req.locals.dentistInfo = dentistInfo;

    return next();
  }).catch((error) => {
    next(error);
  });
}


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
      }
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
