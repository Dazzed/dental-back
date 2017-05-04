import { Router } from 'express';
import passport from 'passport';

import db from '../../models';
import {
  adminRequired,
} from '../middlewares';

import {
  NotFoundError
} from '../errors';

const userFieldsExcluded = ['hash', 'salt', 'activationKey',
  'resetPasswordKey', 'verified', 'authorizeId', 'paymentId'];

const router = new Router({ mergeParams: true });


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


router
  .route('/')
  .get(
    passport.authenticate('jwt', { session: false }),
    adminRequired,
    getMembers);


export default router;
