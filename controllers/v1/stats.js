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
    db.User.findAll({
      where: { type: 'dentist' },
      attributes: ['id'],
    }).then(users =>
      // Count user associated dentist offices
      Promise.all(users.map(u =>
        db.DentistInfo.count({
          where: { userId: u.get('id') }
        })
      ))
    ).then(counts => {
      resolve({ dentistOfficeCount: counts.reduce((a, b) => a + (parseInt(b, 10) || 0), 0) });
    })
    .catch(err => reject(err));
  });
}

/**
 * Retrieves active members count
 *
 * @returns {Promise<Object>}
 */
function getActiveUserCount() {
  return new Promise((resolve, reject) => {
    db.Subscription.count().then(count => {
      resolve({ activeUserCount: count });
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
    res.json({ data: stats.reduce((a, b) => Object.assign(a, b)) });
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ROUTES

router.route('/').get(userRequired, adminRequired, getStats);

export default router;
