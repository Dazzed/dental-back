/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';

import { BadRequestError } from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a list of dentist offices
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getOffices(req, res) {
  db.DentistInfo.findAll()
  .then(offices => Promise.all(offices.map(o => o.getFullOffice())))
  .then((offices) => {
    res.json({ data: offices });
  })
  .catch(err => res.json(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getOffices);

export default router;
