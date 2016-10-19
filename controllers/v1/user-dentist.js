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
        monthly: subscription.monthly,
        membership: subscription.Membership,
      });
    });

    res.json({ data });
  }).catch((error) => {
    next(error);
  });
}


function getClients(req, res, next) {
  return db.User.findAll({
    attributes: ['id', 'firstName', 'lastName', 'avatar', 'email',
      'createdAt', 'contactMethod'],
    include: [{
      as: 'clientSubscriptions',
      model: db.Subscription,
      where: {
        dentistId: req.user.get('id'),
      },
      include: [{
        attributes: ['name', 'default'],
        model: db.Membership,
      }]
    }, {
      as: 'familyMembers',
      model: db.FamilyMember,
    }, {
      as: 'phoneNumbers',
      model: db.Phone,
    }],
    subquery: false,
  }).then(clients => {
    const result = [];

    clients.forEach(client => {
      const item = client.toJSON();

      const data = {
        firstName: item.firstName,
        lastName: item.lastName,
        email: item.email,
        dentistInfo: item.dentistInfo,
        createdAt: item.createdAt,
        subscriptions: [],
        familyMembers: item.familyMembers,
        contactMethod: item.contactMethod,
        phoneNumbers: item.phoneNumbers,
      };

      item.clientSubscriptions.forEach(subscription => {
        data.subscriptions.push({
          total: subscription.total,
          startAt: subscription.startAt,
          endAt: subscription.endAt,
          monthly: subscription.monthly,
          status: subscription.status,
          membership: subscription.Membership,
        });
      });

      result.push(data);
    });
    // format data
    res.json({ data: result });
  }).catch((error) => {
    next(error);
  });
}


router
  .route('/dentist')
  .get(
    passport.authenticate('jwt', { session: false }),
    getDentist);


router
  .route('/clients')
  .get(
    passport.authenticate('jwt', { session: false }),
    getClients);


export default router;

