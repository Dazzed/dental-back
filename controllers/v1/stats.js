import { Router } from 'express';

import db from '../../models';
import { userRequired, adminRequired } from '../middlewares';
import { BadRequestError } from '../errors';

const router = new Router({ mergeParams: true });

// ────────────────────────────────────────────────────────────────────────────────
// HANDLERS

function getDentistOfficeStats(req, res) {
  db.DentistInfo.count({
    where: { id: { gt: 0 } }
  }).then(count => {
    res.json({ data: { count } });
  });
}

function getActiveUserStats(req, res) {
  db.User.count({
    where: { verified: true }
  }).then(count => {
    res.json({ data: { count } });
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ROUTES

router
  .route('/dentist-offices')
  .get(
    userRequired,
    adminRequired,
    getDentistOfficeStats);

router
  .route('/active-users')
  .get(
    userRequired,
    adminRequired,
    getActiveUserStats);


export default router;
