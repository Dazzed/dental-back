import { Router } from 'express';

import db from '../../models';
import { userRequired, adminRequired } from '../middlewares';
// import { BadRequestError } from '../errors';

const router = new Router({ mergeParams: true });

// ────────────────────────────────────────────────────────────────────────────────
// HANDLERS

/**
 * Retrieves dentist offices count
 *
 * @returns {Promise<Object>}
 */
function getDentistsCount() {
  return new Promise((resolve, reject) => {
    db.DentistInfo.count({
      where: { id: { gt: 0 } }
    }).then(count => {
      resolve({ count });
    }).catch(err => reject(err));
  });
}

/**
 * Retrieves active members count
 *
 * @returns {Promise<Object>}
 */
function getActiveUserCount() {
  return new Promise((resolve, reject) => {
    db.User.count({
      where: { verified: true }
    }).then(count => {
      resolve({ count });
    }).catch(err => reject(err));
  });
}

/**
 * Retrieves stats
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getStats(req, res) {
  Promise.all([
    getDentistsCount(),
    getActiveUserCount(),
  ]).then(stats => {
    res.json({ data: stats });
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ROUTES

router.route('/').get(userRequired, adminRequired, getStats);

export default router;
