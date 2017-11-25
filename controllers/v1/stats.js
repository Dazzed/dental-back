// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';
import { userRequired, adminRequired } from '../middlewares';
import { BadRequestError } from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Retrieves dentist offices count
 *
 * @returns {Promise<Object>}
 */
async function getDentistsCount() {
  try {
    const dentistsCount = await db.User.count({
      where: {
        type: 'dentist',
        isDeleted: false
      }
    });
    return { dentistOfficeCount: dentistsCount };
  } catch (e) {
    console.log(e, 'Error in getDentistsCount');
    throw e;
  }
}

/**
 * Retrieves active members count
 *
 * @returns {Promise<Object>}
 */
async function getActiveUserCount() {
  try {
    const activeUserCount = await db.Subscription.count({
      where: {
        status: 'active'
      }
    });
    return { activeUserCount };
  } catch (e) {
    console.log(e, 'Error in getActiveUserCount');
    throw e;
  }
}

/**
 * Retrieves stats
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getStats(req, res, next) {
  Promise.all([
    getDentistsCount(),
    getActiveUserCount(),
  ]).then((stats) => {
    res.json({ data: stats.reduce((a, b) => Object.assign(a, b)) });
  }).catch(err => next(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router.route('/')
  .get(
    userRequired,
    adminRequired,
    getStats
  );

export default router;
