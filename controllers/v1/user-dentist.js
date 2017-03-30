import { Router } from 'express';
import passport from 'passport';
import _ from 'lodash';
import changeFactory from 'change-js';
import isPlainObject from 'is-plain-object';
import db from '../../models';
import { BadRequestError } from '../errors';
import { checkUserDentistPermission } from '../../utils/permissions';

import {
  createCreditCard,
  updateCreditCard,
  chargeAuthorize,
} from '../payments';


const Change = changeFactory();
const router = new Router({ mergeParams: true });


function getDentist(req, res, next) {
  req.user.getMyDentist()
    .then(data => {
      // add all the review ratings.
      const totalRating = _.sumBy(
        data.dentistReviews, review => review.rating);

      // average the ratings.
      data.rating = totalRating / data.dentistReviews.length;
      data.dentistReviews
        .filter(review => review.clientId === req.user.get('id'))
        .forEach(review => delete review.clientId);

      res.json({ data });
    })
    .catch(next);
}


function getPendingAmount(req, res, next) {
  let userId = req.params.userId;
  let dentistId = undefined;

  if (userId === 'me' && req.user.get('type') === 'dentist') {
    return next(new BadRequestError('Dentist donnot have subscription'));
  }

  userId = userId === 'me' ? req.user.get('id') : userId;

  if (req.user.get('type') === 'dentist') {
    dentistId = req.user.get('id');
  }

  db.Subscription.getPendingAmount(userId, dentistId)
    .then(({ total }) => {
      res.json({ data: total });
    })
    .catch(next);
}


function chargeBill(req, res, next) {
  let userId = req.params.userId;
  let dentistId = undefined;

  if (userId === 'me' && req.user.get('type') === 'dentist') {
    return next(new BadRequestError('Dentist donnot have subscription'));
  }

  userId = userId === 'me' ? req.user.get('id') : userId;

  if (req.user.get('type') === 'dentist') {
    dentistId = req.user.get('id');
  }

  db.Subscription.getPendingAmount(userId, dentistId)
    .then(({ total, ids, data, userIds }) => {
      if (total > 0) {
        chargeAuthorize(
          req.locals.chargeTo.authorizeId,
          req.locals.chargeTo.paymentId,
          data
        ).then(transactionId => {
          db.Subscription.update({
            paidAt: new Date(),
            status: 'active',
            chargeID: transactionId,
          }, {
            where: { id: { $in: ids } },
          }).then(() => {
            return res.json({ data: userIds });
          });
        }).catch(errors => {
          if (isPlainObject(errors.json)) {
            return next(new BadRequestError(errors.json));
          }

          return next(errors);
        });
      } else {
        res.json({ data: ids });
      }
    })
    .catch(next);

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
    checkUserDentistPermission,
    getDentist);


router
  .route('/pending-amount')
  .get(
    passport.authenticate('jwt', { session: false }),
    checkUserDentistPermission,
    getPendingAmount);

router
  .route('/charge-bill')
  .post(
    passport.authenticate('jwt', { session: false }),
    checkUserDentistPermission,
    ensureCreditCard,
    chargeBill);

router
  .route('/reports')
  .get(
    passport.authenticate('jwt', { session: false }),
    checkUserDentistPermission,
    generateReport);


export default router;
