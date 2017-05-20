// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a list of dentist services
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function getServices(req, res, next) {
  return db.Service.findAll({ raw: true, orderBy: 'createdAt' })
  .then((services) =>
    res.json({ data: services || [] })
  ).catch((error) => {
    next(error);
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getServices);

export default router;
