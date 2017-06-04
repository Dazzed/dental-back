// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';

import {
  userRequired,
  dentistRequired,
} from '../middlewares';

import {
  BadRequestError,
} from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets all members subscribed to the dentist whose id is set in params
 *
 * @param {object} req - the express request
 * @param {object} res - the express response
 */
function getMembers(req, res) {
  if (req.params.dentistId === 'me') {
    req.params.dentistId = req.user.get('id');
  }

  db.User.find({
    where: { id: req.params.dentistId },
  })
  .then((user) => {
    user.getClients()
    .then((members) => {
      res.json({ data: members });
    })
    .catch((err) => { throw new Error(err); });
  })
  .catch(err => res.json(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    userRequired,
    dentistRequired,
    getMembers);

export default router;
