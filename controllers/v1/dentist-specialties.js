// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';

import {
  BadRequestError,
} from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a list of dentist specialties
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - express next middleware
 */
function getDentistSpecialties(req, res, next) {
  return db.DentistSpecialty.findAll({
    attributes: {
      exclude: ['createdAt', 'updatedAt']
    },
  }).then(specialties =>
    res.json({ data: specialties || [] })
  ).catch(err => next(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getDentistSpecialties);


export default router;
