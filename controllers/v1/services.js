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
 * Gets a list of dentist services
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getServices(req, res) {
  return db.Service.findAll({ orderBy: 'createdAt', attributes: ['id', 'name'] })
  .then(services => res.json({ data: services || [] }))
  .catch((error) => { res.json(new BadRequestError(error)); });
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getServices);

export default router;
