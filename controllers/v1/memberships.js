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
  ForbiddenError,
} from '../errors';

import {
  injectSimpleUser,
  injectMembership,
  validateBody,
} from '../middlewares';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

const excludeMembershipFields = ['stripePlanId', 'userId'];

/**
 * Gets the list of available memberships
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getMemberships(req, res) {
  let memberships = [];

  return db.Membership.findAll({
    where: { stripePlanId: { $not: null } },
  })
  .then((members) => {
    memberships = members;
    return Promise.all(members.map(m => m.getPlanCosts()));
  })
  .then((planCosts) => {
    planCosts.forEach((p, i) => {
      memberships[i] = Object.assign({}, memberships[i].toJSON(), planCosts[i]);
    });

    memberships = memberships.map(m => _.omit(m, excludeMembershipFields));

    res.json({ data: memberships || [] });
  })
  .catch((error) => {
    res.json(new BadRequestError(error));
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
    data: _.omit(req.locals.membership.toJSON(), ['stripePlanId']),
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
      data: _.omit(membership.toJSON(), ['stripePlanId']),
    });
  });
}

/**
 * Updates a membership record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function updateMembership(req, res) {
  const data = _.pick(req.body, ['name', 'price', 'description']);

  // if userId is undefined set body param
  if (req.params.userId === undefined) {
    data.userId = req.body.userId;
  }

  return req.locals.membership.update(data).then((membership) => {
    res.json({
      data: _.omit(membership.toJSON(), ['stripePlanId']),
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
  req.locals.membership.update({ stripePlanId: null }).then(() => res.json());
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
  if (req.user.get('id') !== req.locals.membershipUser.get('id') &&
  req.user.get('id') !== req.locals.membershipUser.get('addedBy')) {
    next(new BadRequestError());
  } else {
    // Cancel the membership/subscription
    db.Subscription.update({
      status: 'canceled'
    }, {
      where: { clientId: req.locals.membershipUser.get('id') }
    }).then(() => res.json());
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
  if (req.user.get('id') !== req.locals.membershipUser.get('id') &&
  req.user.get('id') !== req.locals.membershipUser.get('addedBy')) {
    next(new BadRequestError());
  } else {
    // Cancel the membership/subscription
    db.Subscription.update({
      status: 'inactive'
    }, {
      where: { clientId: req.locals.membershipUser.get('id') }
    }).then(() => res.json());
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getMemberships)
  .post(
    validateBody(MEMBERSHIP),
    addMembership);


router
  .route('/:membershipId')
  .get(
    injectMembership(),
    getMembership)
  .put(
    validateBody(MEMBERSHIP),
    injectMembership(),
    updateMembership)
  .delete(
    injectMembership(),
    deleteMembership);

router
  .route('/cancel/:userId')
  .delete(
    injectSimpleUser(),
    cancelMembership
  );

router
  .route('/deactivate/:userId')
  .delete(
    injectSimpleUser(),
    deactivateMembership
  );

export default router;
