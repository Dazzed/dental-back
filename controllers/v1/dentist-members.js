// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';

import {
  userRequired,
  adminRequired,
} from '../middlewares';

import {
  NotFoundError
} from '../errors';

const userFieldsExcluded = ['hash', 'salt', 'activationKey',
  'resetPasswordKey', 'verified', 'authorizeId', 'paymentId'];

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets all members subscribed to the dentist whose ID is set in params.
 */
function getMembers(req, res, next) {
  const dentistId = req.params.dentistId;

  db.User.find({
    attributes: { exclude: userFieldsExcluded },
    where: {
      id: dentistId,
      type: 'dentist'
    }
  })
  .then(dentist => {
    if (!dentist) {
      throw new NotFoundError('The dentist account was not found.');
    }

    return dentist.getClients().then(members => {
      res.json({ data: members });
    });
  })
  .catch(next);
}

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    userRequired,
    adminRequired,
    getMembers);


export default router;
