// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';

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
  ).catch((error) => {
    next(error);
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getDentistSpecialties);


export default router;
