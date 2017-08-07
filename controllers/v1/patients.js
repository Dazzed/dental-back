// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';
import { BadRequestError } from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Toggles the cancellation fee waiver flag on a user record.
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function toggleCancellationFeeWaiver(req, res, next) {
  let user = {};

  // Get the requested user's subscription
  db.User.find({ where: { id: req.params.patientId } })
  .then((userObj) => {
    user = userObj;
    user.cancellationFeeWaiver = !user.cancellationFeeWaiver;
    return user.save();
  })
  .then(() => user.getFullClient())
  .then(data => res.json({ data }))
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Toggles the re-enrollment fee waiver flag on a user record. Enabled here
 * for admins only because the flag would allow free enrollment on any plan for any dentist
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function toggleReEnrollmentFeeWaiver(req, res, next) {
  let user = {};

  // Get the requested user's subscription
  db.User.find({ where: { id: req.params.patientId } })
  .then((userObj) => {
    user = userObj;
    user.reEnrollmentFeeWaiver = !user.reEnrollmentFeeWaiver;
    return user.save();
  })
  .then(() => user.getFullClient())
  .then(data => res.json({ data }))
  .catch(err => next(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/:patientId/toggle-cancellation-waiver')
  .put(toggleCancellationFeeWaiver);

router
  .route('/:patientId/toggle-reenrollment-waiver')
  .put(toggleReEnrollmentFeeWaiver);

export default router;
