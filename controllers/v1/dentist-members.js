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
  NotFoundError,
} from '../errors';

const userFieldsExcluded = ['hash', 'salt', 'activationKey',
  'resetPasswordKey', 'verified', 'authorizeId', 'paymentId'];

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

  Promise.resolve()
  .then(() => (
    db.User.find({
      attributes: { exclude: userFieldsExcluded },
      where: {
        id: req.params.dentistId,
        type: 'dentist',
      }
    })
  ))
  .then((dentist) => {
    if (!dentist) {
      return res.json(new NotFoundError('The dentist account was not found'));
    }

    return dentist.getClients();
  })
  .then((members) => {
    res.json({ data: members });
  })
  .catch((err) => {
    res.json(new BadRequestError(err));
  });
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
