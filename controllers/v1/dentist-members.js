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

  db.User.find({
    where: { id: req.params.dentistId },
  }).then((user) => {
    user.getClients()
    .then((members) => {
      res.json({ data: members });
    })
    .catch((err) => {
      res.json(new BadRequestError(err));
    });
  });

  // Promise.resolve()
  // .then(() => (
  //   db.Subscription.findAll({
  //     where: {
  //       dentistId: req.params.dentistId,
  //       status: { $not: 'canceled' },
  //     },
  //     include: [{
  //       model: db.User,
  //       attributes: { exclude: userFieldsExcluded },
  //       as: 'client',
  //       include: [{
  //         model: db.Phone,
  //         as: 'phoneNumbers',
  //       }, {
  //         model: db.Review,
  //         as: 'clientReviews',
  //         attributes: { exclude: ['clientId', 'dentistId'] },
  //       }]
  //     }],
  //   })
  // ))
  // .then((subscriptions) => {
  //   if (!subscriptions) {
  //     res.json(new NotFoundError('The dentist account has no members'));
  //   }

  //   Promise.all(subscriptions.map(s => s.client.getMembers()))
  //   .then((members) => {
  //     members = members.map((m, i) => Object.assign({}, subscriptions[i].toJSON(), { members: m }));
  //     return res.json({ data: members });
  //   })
  //   .catch((err) => { throw new Error(err); });
  // })
  // .catch((err) => {
  //   res.json(new BadRequestError(err));
  // });
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
