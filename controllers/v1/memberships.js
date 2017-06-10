// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import _ from 'lodash';
import { Router } from 'express';

import db from '../../models';

import {
  BadRequestError,
} from '../errors';

import {
  injectMembership,
} from '../middlewares';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

const excludeMembershipFields = ['stripePlanId', 'userId', 'price'];

/**
 * Gets the list of available memberships
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getMemberships(req, res, next) {
  let memberships = [];

  return db.Membership.findAll({
    where: { stripePlanId: { $not: null } },
  })
  .then((members) => {
    memberships = members;
    return Promise.all(members.map(m => m.getPlanCosts()));
  })
  .then((planCosts) => {
    // Add plan costs
    planCosts.forEach((p, i) => {
      memberships[i] = Object.assign({}, memberships[i].toJSON(), planCosts[i]);
    });

    // Omit fields
    memberships = memberships.map(m => _.omit(m, excludeMembershipFields));

    res.json({ data: memberships || [] });
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Gets a membership record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getMembership(req, res) {
  res.json({ data: req.locals.membership });
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getMemberships);


router
  .route('/:membershipId')
  .get(
    injectMembership(),
    getMembership);

export default router;
