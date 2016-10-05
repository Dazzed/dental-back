import { Router } from 'express';
import passport from 'passport';

import db from '../../models';


const router = new Router({ mergeParams: true });


function getDentist(req, res, next) {
  return db.User.find({
    attributes: ['id', 'firstName', 'lastName', 'avatar'],
    include: [{
      as: 'dentistSubscriptions',
      model: db.Subscription,
      where: {
        endAt: { $gte: new Date() },
        clientId: req.user.get('id'),
      },
      include: [{
        attributes: ['name', 'default'],
        model: db.Membership,
      }]
    }, {
      attributes: {
        exclude: ['id', 'membershipId', 'userId'],
      },
      as: 'dentistInfo',
      model: db.DentistInfo,
    }],
    subquery: false,
  }).then((user) => {
    // format data
    const result = user.toJSON();
    const data = {
      firstName: result.firstName,
      lastName: result.lastName,
      dentistInfo: result.dentistInfo,
      subscriptions: [],
    };

    result.dentistSubscriptions.forEach(subscription => {
      data.subscriptions.push({
        total: subscription.total,
        startAt: subscription.startAt,
        endAt: subscription.endAt,
        membership: subscription.Membership,
      });
    });

    res.json({ data });
  }).catch((error) => {
    next(error);
  });
}


router
  .route('/')
  .get(
    passport.authenticate('jwt', { session: false }),
    getDentist);


export default router;

