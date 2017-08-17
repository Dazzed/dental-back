// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import _ from 'lodash';
import { Router } from 'express';

import db from '../../models';

import {
  EXCLUDE_FIELDS_LIST as excludeUserFields
} from '../../models/user';

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
 * @param {Function} next - the express next request handler
 */
async function getMembers(req, res, next) {
  if (req.params.dentistId === 'me') {
    req.params.dentistId = req.user.get('id');
  }

  const user = await db.User.find({
    where: { id: req.params.dentistId },
  });
  const members = await user.getClientsRevised();
  res.json({ data: members });
}

function getPendingAmounts(req, res, next) {
  // 1. Get all subscribed customers + the attached client info, keep track of status
  // 2. Get their pending amounts
  // 3. Return email, name, pending amount, status
  let subs = [];

  db.Subscription.findAll({
    where: { dentistId: req.params.dentistId },
    attributes: ['status', 'endAt', 'clientId', 'dentistId'],
    include: [{
      model: db.User,
      attributes: {
        exclude: excludeUserFields,
      },
      as: 'client',
    }]
  })
  .then((_subs) => {
    subs = _subs;
    return Promise.all(subs.map(s => db.Subscription.getPendingAmount(s.clientId)));
  })
  .then((pendingAmounts) => {
    res.json({ data: _.zip(subs, pendingAmounts).map(x => x.shift()) });
  })
  .catch((err) => {
    next(new BadRequestError(err));
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getMembers);

router
  .route('/pending-amount')
  .get(getPendingAmounts);

export default router;
