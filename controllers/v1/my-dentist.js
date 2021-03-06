// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import changeFactory from 'change-js';

import db from '../../models';
import { BadRequestError } from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

const Change = changeFactory();

/**
 * Gets the dentist record from the url params
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getDentist(req, res, next) {
  req.user.getMyDentist()
  .then((data) => {
    delete data.email;
    res.json({ data });
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Gets the remaining amount to be paid for the user in the current month.
 * Amount is aware of family billings and not including annual bills.
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getPendingAmount(req, res, next) {
  let userId = req.params.userId;

  if (userId === 'me' && req.user.get('type') === 'dentist') {
    return res.json(new BadRequestError('A Dentist cannot have a subscription'));
  }

  userId = userId === 'me' ? req.user.get('id') : userId;

  return db.Subscription.getPendingAmount(userId)
  .then((total) => {
    res.json({ data: total });
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Generates a CSV report
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function generateReport(req, res, next) {
  // FIXME: Generate CSV report linked with Stripe.js ? or rather not sure what this is for
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
        attributes: ['name'],
        model: db.Membership,
      }]
    }, {
      as: 'familyMembers',
      model: db.FamilyMember,
      required: false,
      where: { isDeleted: false },
      include: [{
        model: db.MemberSubscription,
        as: 'subscription',
        attributes: {
          exclude: ['memberId', 'membershipId', 'subscriptionId']
        },
      }]
    }, {
      as: 'phoneNumbers',
      model: db.Phone,
    }],
    subquery: false,
  }).then((clients) => {
    const result = [];
    let total = new Change({ cents: 0 });

    clients.forEach((client) => {
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

      item.familyMembers.forEach((member) => {
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
  }).catch(err => next(new BadRequestError(err)));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getDentist);

router
  .route('/pending-amount')
  .get(getPendingAmount);

router
  .route('/reports')
  .get(generateReport);

export default router;
