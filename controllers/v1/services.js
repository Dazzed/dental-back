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
 * @param {Function} next - the express next request handler
 */
function getServices(req, res, next) {
  return db.Service.findAll({ orderBy: 'createdAt', attributes: ['id', 'name'] })
  .then(services => res.json({ data: services || [] }))
  .catch(err => next(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getServices);

export default router;
