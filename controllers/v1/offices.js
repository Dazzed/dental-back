// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a list of dentist offices
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getOffices(req, res, next) {
  db.DentistInfo.findAll({
    attributes: ['officeName', 'id'],
    raw: true,
  })
  .then((offices) => { res.json({ data: offices }); })
  .catch(next);
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getOffices);

export default router;
