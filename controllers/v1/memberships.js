// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import HTTPStatus from 'http-status';
import _ from 'lodash';

import db from '../../models';

import {
  MEMBERSHIP,
} from '../../utils/schema-validators';

import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../errors';

import {
  userRequired,
} from '../middlewares';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Fills the request object with the membership record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function getMembershipFromParams(req, res, next) {
  const userId = req.params.userId;

  /*
   * If user is not admin, or parent of user and try to requests paths not related
   * to that user will return forbidden.
   */
  db.User.count({
    where: {
      id: userId,
      addedBy: req.user.get('id')
    }
  }).then(count => {
    const canEdit =
      userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
      req.user.get('type') === 'admin' || count >= 1;

    if (!canEdit) {
      return next(new ForbiddenError());
    }

    const query = {
      where: {
        id: req.params.membershipId,
      }
    };

    // if not admin limit query to related data userId
    if (req.user.get('type') !== 'admin') {
      query.where.userId = req.user.get('id');
      query.where.isDeleted = false;  // this to save
    }

    return db.Membership.find(query);
  }).then((membership) => {
    if (!membership) {
      next(new NotFoundError());
    }

    req.locals.membership = membership;
    next();
  }).catch((error) => {
    next(error);
  });
}

/**
 * Injects the user object into the request
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function getUserFromParams(req, res, next) {
  let id = req.params.userId;

  if (id === 'me') id = req.user.get('id');

  Promise.resolve()
  .then(() => db.User.find({ where: { id } }))
  .then(user => {
    if (!user || req.params.userId !== 'me') next(new BadRequestError());
    req.membershipUser = user;
    next();
  }).catch(err => {
    console.log(err);
    next(new BadRequestError());
  });
}

// TODO: add pagination and filters?
/**
 * Gets the list of available memberships
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function getMemberships(req, res, next) {
  const userId = req.params.userId;

  /*
   * If user is not admin and try to requests paths not related
   * to that user will return forbidden.
   */
  const canEdit =
    userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
    req.user.get('type') === 'admin';

  if (!canEdit) {
    return next(new ForbiddenError());
  }

  const query = {
    attributes: { exclude: ['isDeleted'] },
    where: {
      isDeleted: false,
    },
    raw: true
  };

  // if not admin limit query to related data userId
  if (req.user.get('type') !== 'admin') {
    query.where.userId = req.user.get('id');
  }

  return db.Membership.findAll(query).then((members) =>
    res.json({ data: members || [] })
  ).catch((error) => {
    next(error);
  });
}

/**
 * Gets a membership record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getMembership(req, res) {
  res.json({
    data: _.omit(req.locals.membership.toJSON(), ['isDeleted']),
  });
}

/**
 * Adds a new membership record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function addMembership(req, res, next) {
  const userId = req.params.userId;

  /*
   * If user is not admin and try to requests paths not related
   * to that user will return forbidden.
   */
  let canCreate = req.user.get('type') === 'dentist' &&
    (userId === 'me' || req.user.get('id') === parseInt(userId, 10));

  // enable admin to add memberships
  canCreate |= req.user.get('type') === 'admin';

  // only can add to over userId
  if (!canCreate) {
    return next(new ForbiddenError());
  }

  req.checkBody(MEMBERSHIP);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

  const data = _.pick(req.body, ['name', 'price', 'description']);

  // if userId is not set or is me set to loggedin user id.
  if (userId === 'me') {
    data.userId = req.user.get('id');
  }

  // if userId is undefined set body param
  if (userId === undefined) {
    data.userId = req.body.userId;
  }

  return db.Membership.create(data).then((membership) => {
    res.status(HTTPStatus.CREATED);
    res.json({
      data: _.omit(membership.toJSON(), ['isDeleted']),
    });
  });
}

/**
 * Updates a membership record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function updateMembership(req, res, next) {
  req.checkBody(MEMBERSHIP);

  const errors = req.validationErrors(true);

  if (errors) {
    return next(new BadRequestError(errors));
  }

  const data = _.pick(req.body, ['name', 'price', 'description']);

  // if userId is undefined set body param
  if (req.params.userId === undefined) {
    data.userId = req.body.userId;
  }

  return req.locals.membership.update(data).then((membership) => {
    res.json({
      data: _.omit(membership.toJSON(), ['isDeleted']),
    });
  });
}

/**
 * Deletes a membership record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function deleteMembership(req, res) {
  req.locals.membership.update({ isDeleted: true }).then(() => res.end());
}

/**
 * Cancels a membership plan for a user account
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function cancelMembership(req, res, next) {
  // Check if the user has access to cancel the user
  if (req.user.get('id') !== req.membershipUser.get('id') &&
  req.user.get('id') !== req.membershipUser.get('addedBy')) {
    next(new BadRequestError());
  } else {
    // Cancel the membership/subscription
    db.Subscription.update({
      status: 'canceled'
    }, {
      where: { clientId: req.membershipUser.get('id') }
    }).then(() => res.end());
  }
}

/**
 * Deactivates a user from a membership plan
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Object} next - the next middleware function
 */
function deactivateMembership(req, res, next) {
  // Check if the user has access to cancel the user
  if (req.user.get('id') !== req.membershipUser.get('id') &&
  req.user.get('id') !== req.membershipUser.get('addedBy')) {
    next(new BadRequestError());
  } else {
    // Cancel the membership/subscription
    db.Subscription.update({
      status: 'inactive'
    }, {
      where: { clientId: req.membershipUser.get('id') }
    }).then(() => res.end());
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    userRequired,
    getMemberships)
  .post(
    userRequired,
    addMembership);


router
  .route('/:membershipId')
  .get(
    userRequired,
    getMembershipFromParams,
    getMembership)
  .put(
    userRequired,
    getMembershipFromParams,
    updateMembership)
  .delete(
    userRequired,
    getMembershipFromParams,
    deleteMembership);

router
  .route('/cancel/:userId')
  .delete(
    userRequired,
    getUserFromParams,
    cancelMembership
  );

router
  .route('/deactivate/:userId')
  .delete(
    userRequired,
    getUserFromParams,
    deactivateMembership
  );

export default router;
