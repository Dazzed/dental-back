import { Router } from 'express';
import passport from 'passport';
import changeFactory from 'change-js';
import isPlainObject from 'is-plain-object';
import db from '../../models';
import { BadRequestError } from '../errors';
import {
  createCreditCard,
  updateCreditCard,
  chargeAuthorize,
} from '../payments';


const Change = changeFactory();
const router = new Router({ mergeParams: true });


function getDentist(req, res, next) {
  req.user.getMyDentist()
    .then(data => res.json({ data }))
    .catch(next);
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
    include: [{
      attributes: ['payingMember', 'firstName', 'lastName'],
      model: db.User,
      as: 'client',
    }]
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
      let total = new Change({ dollars: 0 });
      const data = {
        members: []
      };

      if (subscription.get('client').get('payingMember')) {
        const name = subscription.get('client').get('firstName') +
          subscription.get('client').get('firstName');

        data.members.push({
          fullName: name,
          monthly: subscription.get('monthly'),
        });

        total = new Change({ dollars: subscription.get('monthly') });
      }

      members.forEach(item => {
        total = total.add(new Change({ dollars: item.get('monthly') }));
        const name = item.get('member').get('firstName') +
          item.get('member').get('firstName');

        data.members.push({
          fullName: name,
          monthly: item.get('monthly'),
        });
      });

      data.total = total.dollars().toFixed(2);

      chargeAuthorize(
        req.locals.chargeTo.authorizeId,
        req.locals.chargeTo.paymentId,
        data
      ).then(transactionId => {
        subscription.update({
          paidAt: new Date(),
          status: 'active',
          chargeID: transactionId,
        });

        return res.json({ status: 'active' });
      }).catch(errors => {
        if (isPlainObject(errors.json)) {
          return next(new BadRequestError(errors.json));
        }

        return next(errors);
      });
    }
  }).catch(next);
}


/**
 * Ensure card exists, create or update card if needed.
 *
 */
function ensureCreditCard(req, res, next) {
  let userId = req.params.userId;

  if (userId === 'me') {
    userId = req.user.get('id');
  }

  db.User.find({
    where: { id: userId },
    attributes: ['authorizeId', 'id', 'email', 'paymentId'],
    raw: true,
  }).then((user) => {
    if (!user.authorizeId) {
      return createCreditCard(user, req.body.card)
        .then(([authorizeId, paymentId]) => {
          db.User.update({
            authorizeId,
            paymentId,
          }, {
            where: { id: userId }
          });
          user.authorizeId = authorizeId;
          user.paymentId = paymentId;
          return user;
        });
    } else if (req.body.card) {
      return updateCreditCard(user.authorizeId, user.paymentId, req.body.card)
        .then(() => user);
    }
    return user;
  }).then((user) => {
    req.locals.chargeTo = user;
    next();
  })
    .catch((errors) => {
      if (isPlainObject(errors.json)) {
        return next(new BadRequestError(errors.json));
      }

      return next(errors);
    });
}


function generateReport(req, res, next) {
  return db.User.findAll({
    attributes: ['id', 'firstName', 'lastName', 'email',
      'createdAt', 'contactMethod', 'payingMember'],
    include: [{
      as: 'clientSubscriptions',
      model: db.Subscription,
      where: {
        dentistId: req.user.get('id'),
        status: 'active',
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
    }],
    subquery: false,
  }).then(clients => {
    const result = [];
    let total = new Change({ cents: 0 });

    clients.forEach(client => {
      const item = client.toJSON();

      result.push({
        '': 'Primary Acct Holder',
        Name: `${item.lastName}, ${item.firstName}`,
        Number: item.phoneNumbers[0].number,
        Email: item.email,
        'Monthly charge': item.payingMember ?
          `$${item.clientSubscriptions[0].monthly}` : '-',
      });

      if (item.payingMember) {
        total = total.add(new Change({
          dollars: item.clientSubscriptions[0].monthly,
        }));
      }

      item.familyMembers.forEach(member => {
        result.push({
          '': 'Family Member',
          Name: `${member.lastName}, ${member.firstName}`,
          Number: member.phone,
          Email: member.email,
          'Monthly charge': `$${member.subscriptions[0].monthly}`,
        });

        total = total.add(new Change({
          dollars: member.subscriptions[0].monthly,
        }));
      });
    });

    result.push({});
    result.push({
      '': '',
      Name: '',
      Number: '',
      Email: 'Total',
      'Monthly charge': `$${total.dollars()}`,
    });

    // format data
    res.csv(result, true);
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
  .route('/bill')
  .get(
    passport.authenticate('jwt', { session: false }),
    getBill);

router
  .route('/charge-bill')
  .post(
    passport.authenticate('jwt', { session: false }),
    ensureCreditCard,
    chargeBill);

router
  .route('/reports')
  .get(
    passport.authenticate('jwt', { session: false }),
    generateReport);


export default router;

