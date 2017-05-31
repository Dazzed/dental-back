/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import _ from 'lodash';
import db from '../models';

import { MembershipMethods } from '../orm-methods/memberships';
import { generateRandomEmail } from '../utils/helpers';
import stripe from '../controllers/stripe';

const userFieldsExcluded = ['hash', 'salt', 'activationKey', 'resetPasswordKey', 'verified'];

// ────────────────────────────────────────────────────────────────────────────────
// EXPORTS

export const instance = {

  /**
   * Retrieves details about the users subscription
   *
   * @returns {Promise<SubscriptionDetails>}
   */
  getSubscription() {
    const userId = this.get('id');
    let subscriptionObj = {};

    if (this.get('type') === 'dentist') {
      throw new Error('Dentist cannot have a subscription');
    }

    return new Promise((resolve, reject) => {
      db.Subscription.findAll({
        where: { clientId: userId },
        include: [{
          model: db.Membership,
          as: 'membership'
        }]
      })
      .then((sub) => {
        if (!sub || !!sub.membership) resolve({});
        subscriptionObj = sub;
        return sub.membership.getPlanCosts();
      })
      .then((planCosts) => {
        resolve(Object.assign(
          {},
          planCosts,
          {
            status: subscriptionObj.status
          })
        );
      })
      .catch(reject);
    });
  },

  /**
   * Retrieves reviews made against this dentist user
   *
   * @returns {Promise<Review[]>}
   */
  getDentistReviews() {
    return db.Review.findAll({
      where: { dentistId: this.get('id') },
      attributes: { exclude: ['clientId', 'dentistId'] }
    });
  },

  /**
   * Returns all clients/subscriptions
   *
   * @returns {Promise<User[]>}
   */
  getClients() {
    const dentistId = this.get('id');

    return new Promise((resolve, reject) => {
      db.Subscription.findAll({
        where: { dentistId },
        attributes: {
          exclude: ['id', 'stripeSubscriptionId', 'paymentProfileId', 'membershipId', 'clientId', 'dentistId'],
        },
        status: { $not: 'canceled' },
        include: [{
          model: db.Membership,
          as: 'membership',
        }, {
          model: db.User,
          as: 'client',
          attributes: {
            exclude: userFieldsExcluded,
          },
          where: { isDeleted: false },
          include: [{
            model: db.User,
            as: 'members',
            attributes: {
              exclude: userFieldsExcluded,
            },
          }, {
            model: db.Phone,
            as: 'phoneNumbers',
          }, {
            model: db.Review,
            as: 'clientReviews',
            attributes: { exclude: ['clientId', 'dentistId'] },
          }]
        }]
      })
      .then((subs) => {
        Promise.all(subs.map(s => s.membership.getPlanCosts()))
        .then((plans) => {
          subs = subs.map(s => s.toJSON());
          subs.forEach((s, i) => (subs[i].membership = plans[i]));
          resolve(subs);
        })
        .catch(reject);
      })
      .catch(reject);
    });
  },

  /**
   * Gets associated members of this primary account
   *
   * @returns {Promise<User[]>}
   */
  getMyMembers() {
    return new Promise((resolve, reject) => {
      db.User.findAll({
        attributes: { exclude: userFieldsExcluded },
        where: {
          $or: [{
            addedBy: this.get('id'),
          }, {
            id: this.get('id'),
          }],
          isDeleted: false,
        },
        include: [{
          model: db.Membership,
          as: 'memberships'
        }, {
          model: db.Subscription,
          as: 'clientSubscription',
          limit: 1,
          order: '"status" DESC',
        }, {
          model: db.Phone,
          as: 'phoneNumbers',
        }],
        subquery: false,
      })
      .then(users => (
        Promise.all(
          users.map(userObj => (
            new Promise((res, rej) => {
              userObj.getSubscription()
              .then((subscription) => {
                const parsed = userObj.toJSON();

                parsed.subscription = subscription;

                parsed.phone = parsed.phoneNumbers[0] ?
                  parsed.phoneNumbers[0].number : undefined;

                delete parsed.clientSubscription;
                delete parsed.phoneNumbers;

                res(parsed);
              })
              .catch(rej);
            })
          ))
        )
      ))
      .catch(reject);
    });
  },

  /**
   * Gets the associated dentist record for the user
   *
   * @param {boolean} omitInclude - flag to omit included properties
   * @returns {Promise<Dentist>}
   */
  getMyDentist(omitInclude) {
    const query = {
      attributes: ['id', 'firstName', 'lastName', 'avatar', 'email'],
      subquery: false,
      loggin: console.log,
    };

    if (!omitInclude) {
      query.include = [{
        model: db.Subscription,
        as: 'dentistSubscription',
        where: { status: { $not: 'canceled' }, clientId: this.get('id') },
        include: [{
          model: db.Membership,
          as: 'memberships',
        }]
      }, {
        model: db.Review,
        as: 'dentistReviews'
      }, {
        as: 'dentistInfo',
        model: db.DentistInfo,
        attributes: {
          exclude: ['membershipId', 'userId', 'childMembershipId'],
        },
        include: [{
          model: db.Membership,
          as: 'membership',
          attributes: {
            exclude: ['userId'],
          },
        }, {
          model: db.Membership,
          as: 'childMembership',
          attributes: {
            exclude: ['userId'],
          },
        }, {
          model: db.DentistInfoService,
          as: 'services',
          attributes: ['dentistInfoId', 'serviceId'],
          include: [{
            model: db.Service,
            attributes: ['name'],
            as: 'service'
          }]
        }, {
          model: db.WorkingHours,
          as: 'workingHours'
        }, {
          model: db.DentistInfoPhotos,
          as: 'officeImages',
          attributes: ['url']
        }]
      }];
    }

    let parsed = {};
    let dentistObj = {};

    return db.User.find(query)
    .then((dentist) => {
      parsed = dentist ? dentist.toJSON() : {};
      dentistObj = dentist;

      if (omitInclude) return [parsed, dentist];

      delete parsed.dentistSubscriptions;

      const dentistReviews = parsed.dentistReviews || [];

      // add all the review ratings.
      const totalRating = _.sumBy(
        dentistReviews, review => review.rating);
      // average the ratings.
      parsed.rating = totalRating / dentistReviews.length;
      const reviews = dentistReviews
        .filter(review => review.clientId === this.get('id'));

      reviews
      .forEach((review) => {
        delete review.clientId;
        delete review.dentistId;
      });
      parsed.dentistReviews = reviews;

      // Expand membership details from stripe
      return Promise.all(
        dentist.dentistInfo.membership.getPlanCosts(),
        dentist.dentistInfo.childMembership.getPlanCosts(),
      );
    })
    .then((memberships) => {
      parsed.membership = memberships[0] || {};
      parsed.childMembership = memberships[1] || {};

      return [parsed, dentistObj];
    });
  },

  /**
   * Creates a new subscription record
   *
   * @param {number} membershipId - the id of the membership to subscribe to
   * @param {number} dentistId - the ID of the dentist providing the membership
   * @returns {Promise<Subscription>}
   */
  createSubscription(membershipId, dentistId) {
    if (this.get('type') === 'dentist') {
      throw new Error('Dentist type cannot have a subscription');
    }

    const clientId = this.get('id');

    return new Promise((resolve, reject) => {
      db.PaymentProfile.find({
        where: {
          $or: [{
            primaryAccountHolderId: this.get('id'),
          }, {
            primaryAccountHolderId: this.get('addedBy'),
          }]
        }
      })
      .then((profile) => {
        if (!profile) throw new Error('User has no associated payment profile');
        return stripe.createSubscription(
          stripe.createUniqueID(clientId, dentistId),
          profile.get('stripeCustomerId'),
        );
      })
      .then(([id, status]) => {
        db.Subscription.create({
          stripeSubscriptionId: id,
          clientId,
          membershipId,
          dentistId,
          status,
        })
        .then(resolve)
        .catch(reject);
      })
      .catch(reject);
    });
  },

  /**
   * Creates a notification for the user
   *
   * @param {object<Notification>} data - the notification object
   * @returns {Promise<Notification>}
   */
  createNotification(data) {
    return db.Notification.create(
      Object.assign(data, {
        recipientId: this.get('id')
      })
    );
  },

  /**
   * Gets the complete dentist record
   *
   * @param {string} [id=this.get('id')] - the id of the current dentist user
   * @returns {Promise<FullDentist>}
   */
  getFullDentist(id = this.get('id')) {
    let d = {};

    return Promise.resolve().then(() => (
      db.User.find({
        attributes: {
          exclude: userFieldsExcluded
        },
        where: {
          id,
          type: 'dentist'
        },
        include: [{
          as: 'dentistInfo',
          model: db.DentistInfo,
          attributes: {
            exclude: ['membershipId', 'userId', 'childMembershipId'],
          },
          include: [{
            model: db.Membership,
            as: 'membership',
            attributes: {
              exclude: ['userId'],
            },
          }, {
            model: db.Membership,
            as: 'childMembership',
            attributes: {
              exclude: ['userId'],
            },
          }, {
            model: db.DentistInfoService,
            as: 'services',
            attributes: ['dentistInfoId', 'serviceId'],
            include: [{
              model: db.Service,
              attributes: ['name'],
              as: 'service'
            }]
          }, {
            model: db.WorkingHours,
            as: 'workingHours'
          }, {
            model: db.DentistInfoPhotos,
            attributes: ['url'],
            as: 'officeImages'
          }]
        }]
      })
    ))
    .then((dentist) => {
      if (dentist == null) return Promise.resolve([]);
      d = dentist.toJSON();
      const dentistInfoId = d.dentistInfo ? d.dentistInfo.id : 0;
      // Retrieve Price Codes
      return db.MembershipItem.findAll({
        where: { dentistInfoId },
        include: [{
          model: db.PriceCodes,
          as: 'priceCode'
        }]
      });
    })
    .then((items) => {
      d.dentistInfo = d.dentistInfo || {};
      d.dentistInfo.priceCodes = items.map((i) => {
        const temp = i.priceCode.toJSON();
        temp.price = i.get('price');
        return i.priceCode;
      });

      d.dentistInfo.membership = d.dentistInfo.membership || {};
      d.dentistInfo.childMembership = d.dentistInfo.childMembership || {};

      // Calculate membership costs
      return MembershipMethods
      .calculateCosts(d.dentistInfo.id, [
        d.dentistInfo.membership.id,
        d.dentistInfo.childMembership.id,
      ]);
    })
    .then((fullCosts) => {
      fullCosts.forEach((cost) => {
        if (d.dentistInfo.membership.id === cost.membershipId) {
          d.dentistInfo.membership.fullCost = cost.fullCost;
          d.dentistInfo.membership.savings = (cost.fullCost - (parseInt(d.dentistInfo.membership.price, 10) * 12));
        } else if (d.dentistInfo.childMembership.id === cost.membershipId) {
          d.dentistInfo.childMembership.fullCost = cost.fullCost;
          d.dentistInfo.childMembership.savings = (cost.fullCost - (parseInt(d.dentistInfo.childMembership.price, 10) * 12));
        }
      });

      // Retrieve Active Member Count
      return db.Subscription.count({
        where: {
          dentistId: d.dentistInfo.id,
          status: 'active',
        }
      });
    })
    .then((activeMemberCount) => {
      d.dentistInfo.activeMemberCount = activeMemberCount;
      // Expand Membership
      return d.dentistInfo.membership.getPlanCosts();
    })
    .then((planCosts) => {
      d.dentistInfo.membership = planCosts;
      // Expand Child Membership
      return d.dentistInfo.childMembership.getPlanCosts();
    })
    .then((planCosts) => {
      d.dentistInfo.childMembership = planCosts;
      return Promise.resolve(d);
    });
  }
};


export const model = {

  /**
   * Gets the associated member object of the user
   *
   * @param {number} addedBy - the id of the user who added the member
   * @param {number} memberId - the id of the member user
   * @returns {Promise<Member>}
   */
  getMyMember(addedBy, memberId) {
    let parsed = {};

    return db.User.find({
      attributes: { exclude: userFieldsExcluded },
      where: {
        addedBy,
        id: memberId,
        isDeleted: false,
      },
      include: [{
        model: db.Phone,
        as: 'phoneNumbers',
      }],
      subquery: false,
    })
    .then((member) => {
      parsed = member ? member.toJSON() : {};

      if (member) {
        parsed.phone = parsed.phoneNumbers[0] ?
          parsed.phoneNumbers[0].number : null;
        delete parsed.phoneNumbers;
      }

      return member.getSubscription();
    })
    .then((subscription) => {
      parsed.subscription = subscription;
      return parsed;
    });
  },

  /**
   * Creates an associated member record
   *
   * @param {object} data - the information of the new member
   * @param {object} user - the parent user
   * @returns {Promise<Member>}
   */
  addMember(data, user) {
    const membership = data.subscription;
    let member;

    data.addedBy = user.get('id');
    data.hash = 'NOT_SET';
    data.salt = 'NOT_SET';
    data.type = 'client';
    // FIXME: Why generate a random email?
    data.email = generateRandomEmail();

    return Promise.resolve()
    .then(() => db.User.create(data))
    .then((_member) => {
      member = _member;
      return db.Subscription.find({
        attributes: ['dentistId', 'id'],
        where: { clientId: user.get('id') }
      });
    })
    .then(subscription => member.createSubscription(membership, subscription.dentistId))
    .then((subscription) => {
      const response = member.toJSON();
      response.membership = membership;
      response.subscription = subscription.toJSON();

      return _.omit(response, ['salt', 'hash', 'verified',
        'dentistSpecialtyId', 'isDeleted', 'resetPasswordKey'
      ]);
    });
  }
};
