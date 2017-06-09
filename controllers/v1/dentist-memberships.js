/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import _ from 'lodash';
import { Router } from 'express';

import db from '../../models';

import { UPDATE_MEMBERSHIP } from '../../utils/schema-validators';

import {
  BadRequestError,
} from '../errors';

import {
  validateBody,
  injectDentistMembership,
} from '../middlewares';

// ────────────────────────────────────────────────────────────────────────────────
// DENTIST RELATED MEMBERSHIPS

const PRIV_MEMBERSHIP_FIELDS = ['price', 'stripePlanId', 'userId'];

/**
 * Gets all the dentist's membership records
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function getMemberships(req, res, next) {
  let memberships = [];

  db.Membership.findAll({
    userId: req.params.dentistId,
  })
  .then((mems) => {
    if (!mems) throw new Error('Requested Membership record does not exist!');
    memberships = mems.map(m => m.toJSON());
    return Promise.all(mems.map(m => m.getPlanCosts()));
  })
  .then((planCosts) => {
    memberships = _.zip(memberships, planCosts);
    memberships = memberships.map(m => Object.assign(...Object.values(m)));
    memberships = memberships.map(m => _(m).omit(['stripePlanId', 'userId', 'price']));
    res.json({ data: memberships });
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Gets the dentist's membership record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getMembership(req, res) {
  res.json({ data: req.locals.membership });
}

/**
 * Updates the dentist's membership record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function updateMembership(req, res, next) {
  let membership = {};

  db.Membership.findOne({
    where: { id: req.params.membershipId },
  })
  .then((mem) => {
    if (!mem) throw new Error('Failed to update membership record');
    return mem.update(req.body);
  })
  .then((mem) => {
    membership = mem.toJSON();
    return mem.getPlanCosts();
  })
  .then(data => res.json({ data: Object.assign({}, _.omit(membership, PRIV_MEMBERSHIP_FIELDS), data) }))
  .catch(err => next(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getMemberships);

router
  .route('/:membershipId')
  .get(injectDentistMembership(), getMembership)
  .put(injectDentistMembership(), validateBody(UPDATE_MEMBERSHIP), updateMembership);

export default router;
