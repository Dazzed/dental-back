import { Router } from 'express';
import passport from 'passport';
import _ from 'lodash';
import changeFactory from 'change-js';
import fetch from 'node-fetch';

import db from '../../models';

const Change = changeFactory();


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
        attributes: ['name', 'default', 'monthly'],
        model: db.Membership,
      }]
    }, {
      as: 'dentistInfo',
      model: db.DentistInfo,
      attributes: {
        exclude: ['id', 'membershipId', 'userId', 'childMembershipId'],
      },
      include: [{
        model: db.Membership,
        as: 'membership',
        attributes: {
          exclude: ['isDeleted', 'default', 'userId'],
        },
      }, {
        model: db.Membership,
        as: 'childMembership',
        attributes: {
          exclude: ['isDeleted', 'default', 'userId'],
        },
      }],
    }],
    subquery: false,
  }).then((user) => {
    // format data
    const result = user.toJSON();
    const data = {
      id: result.id,
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
        status: subscription.status,
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
      'createdAt', 'contactMethod', 'accountHolder'],
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
      required: false,
      where: { isDeleted: false },
      required: false,
      include: [{
        model: db.MemberSubscription,
        as: 'subscriptions',
        attributes: {
          exclude: ['memberId', 'membershipId', 'subscriptionId']
        },
      }]
    }, {
      as: 'phoneNumbers',
      model: db.Phone,
    }, {
      as: 'clientReviews',
      model: db.Review,
      attributes: { exclude: ['clientId', 'dentistId'] },
    }],
    subquery: false,
  }).then(clients => {
    const result = [];

    clients.forEach(client => {
      const item = client.toJSON();

      const data = {
        id: item.id,
        firstName: item.firstName,
        accountHolder: item.accountHolder,
        lastName: item.lastName,
        email: item.email,
        dentistInfo: item.dentistInfo,
        createdAt: item.createdAt,
        subscriptions: [],
        contactMethod: item.contactMethod,
        phoneNumbers: item.phoneNumbers,
        latestReview: _.maxBy(item.clientReviews, _i => _i.id),
      };


      data.familyMembers = item.familyMembers.map(member => {
        const r = _.omit(member, 'subscriptions');
        r.subscription = member.subscriptions[0];
        return r;
      });

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


/**
 * Return latest bill.
 *
 */
function getBill(req, res, next) {
  // FIXME: Do better request, now just for testing
  db.Subscription.find({
    where: {
      clientId: req.user.get('id'),
      $or: [{ status: 'inactive' }, { status: 'active' }],
    },
  }).then(subscription => {
    if (subscription) {
      return Promise.all([
        subscription,
        subscription.getItems({ include: [{
          model: db.FamilyMember,
          as: 'member',
          where: { isDeleted: false },
        }] }),
      ]);
    }
    return [];
  }).then(([subscription, members]) => {
    if (subscription) {
      let total = new Change({
        dollars: req.user.get('accountHolder') ?
          subscription.get('monthly') : 0,
      });

      members.forEach(item => {
        total = total.add(new Change({ dollars: item.get('monthly') }));
      });

      return res.json({
        total: total.cents,
        status: subscription.status,
        endAt: subscription.endAt,
      });
    }

    return res.json({});
  }).catch(next);
}


function chargeBill(req, res, next) {
  const userId =
    req.params.userId === 'me' ? req.user.get('id') : req.params.userId;

  db.Subscription.find({
    where: { clientId: userId, status: 'inactive' },
  }).then(subscription => {
    if (subscription) {
      return Promise.all([
        subscription,
        subscription.getItems({ include: [{
          model: db.FamilyMember,
          as: 'member',
          where: { isDeleted: false },
        }] }),
      ]);
    }
    return [];
  }).then(([subscription, members]) => {
    if (subscription) {
      const memberSubscriptions = [];
      let total = new Change({
        dollars: req.user.get('accountHolder') ?
          subscription.get('monthly') : 0,
      });
      const meta = {
        subscription_id: subscription.get('id'),
      };

      members.forEach(item => {
        total = total.add(new Change({ dollars: item.get('monthly') }));
        memberSubscriptions.push(item.get('id'));
      });

      meta.memberSubscriptions = memberSubscriptions.join(',');

      const url = 'https://core.spreedly.com/v1/gateways/UNdlfrv8cVnLhV9c4SFRfgfgCwP/purchase.json';

      const body = {
        transaction: {
          payment_method_token: req.body.token,
          amount: total.cents,
          currency_code: 'USD',
          retain_on_success: true,
          description: JSON.stringify(meta),
        },
      };

      const encodeString = (new Buffer('MY4WccjEpI34lIikNK7qDAXpRVQ:IXxLQd4Nvur5nv4Od2ZBgN0yWS0WpzYZlM9IzysVdGO4z3rc44sngVcW0n4SxibI').toString('base64'));  // eslint-disable-line

      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        Authorization: `Basic ${encodeString}`,
      };

      fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers,
      }).then(response => response.json()
      ).then(response => {
        if (response.transaction && response.transaction.response.success) {
          subscription.update({
            paidAt: new Date(),
            status: 'active',
            chargeID: req.body.token,
          });

          return res.json({ status: 'active' });
        }

        return res.json({ status: subscription.status });
        // (token => {
        //  alert('Thank you for subscribing!');
      }).catch(error => {
        console.log('Error : ', error);
        // The card has been declined
        res.status = 400;
        return res.json({});
      });
    }
  }).catch(next);
}


router
  .route('/dentist')
  .get(
    passport.authenticate('jwt', { session: false }),
    getDentist);


router
  .route('/bill')
  .get(
    passport.authenticate('jwt', { session: false }),
    getBill);

router
  .route('/charge-bill')
  .post(
    passport.authenticate('jwt', { session: false }),
    chargeBill);

router
  .route('/clients')
  .get(
    passport.authenticate('jwt', { session: false }),
    getClients);


export default router;

