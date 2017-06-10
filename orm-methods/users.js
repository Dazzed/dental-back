/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import _ from 'lodash';
import db from '../models';

import { MembershipMethods } from '../orm-methods/memberships';
import { generateRandomEmail } from '../utils/helpers';
import stripe from '../controllers/stripe';

const userFieldsExcluded = ['hash', 'salt', 'activationKey', 'resetPasswordKey', 'verified', 'createdAt', 'updatedAt'];

// ────────────────────────────────────────────────────────────────────────────────
// EXPORTS

export const instance = {

  /**
   * Retrieves details about the users subscription
   *
   * @returns {Promise<SubscriptionDetails>}
   */
  getMySubscription() {
    const userId = this.get('id');
    let subscriptionObj = {};

    if (this.get('type') === 'dentist') {
      throw new Error('Dentist cannot have a subscription');
    }

    return db.Subscription.find({
      where: { clientId: userId },
      include: [{
        model: db.Membership,
        as: 'membership'
      }]
    })
    .then((sub) => {
      if (!sub || !sub.membership) return Promise.resolve({});
      subscriptionObj = sub;
      return sub.getStripeDetails();
    })
    .then((subDetails) => {
      subscriptionObj.started = subDetails.start;
      return subscriptionObj.membership.getPlanCosts();
    })
    .then(planCosts => ({
      costs: planCosts,
      since: subscriptionObj.started,
      status: subscriptionObj.status,
      plan: subscriptionObj.membership.name,
    }));
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
          exclude: ['id', 'paymentProfileId', 'membershipId', 'clientId', 'dentistId'],
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
          }, {
            model: db.Address,
            as: 'addresses'
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
          as: 'clientSubscription'
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
   * @returns {Promise<FullDentist>}
   */
  getMyDentist() {
    // Find Subscription record of user
    return db.Subscription.find({
      where: { clientId: this.get('id') },
    })
    .then((subscription) => {
      if (!subscription) throw new Error('User has no associated dentist');
      return db.User.find({
        where: { id: subscription.dentistId },
      });
    })
    .then(d => d.getFullDentist())
    .then((dentist) => {
      // Add all review ratings
      dentist.rating = (_(dentist.dentistReviews).sumBy(r => r.rating) || 0) / dentist.dentistReviews.length;
      return dentist;
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
   * Gets the complete user record
   *
   *
   * @param {string} [id=this.get('id')]
   */
  getFullClient(id = this.get('id')) {
    let user = {};

    return Promise.resolve()
    .then(() => (
      db.User.find({
        where: {
          id,
          type: 'client',
        },
        attributes: {
          exclude: userFieldsExcluded
        },
        include: [{
          model: db.Review,
          as: 'clientReviews',
          attributes: {
            exclude: ['createdAt', 'updatedAt', 'dentistId'],
          },
          include: [{
            model: db.User,
            as: 'dentist',
            attributes: {
              exclude: userFieldsExcluded,
            },
          }],
        }, {
          model: db.Subscription,
          as: 'clientSubscription',
          attributes: ['stripeSubscriptionId'],
        }]
      })
    ))
    .then((userObj) => {
      // Get the user's subscription
      if (!userObj) throw new Error('User does not exist');
      user = userObj.toJSON();
      return userObj.getMySubscription();
    })
    .then((subscription) => {
      user.subscription = subscription;
      delete user.clientSubscription;
      return user;
    });
  },

  /**
   * Gets the complete dentist record
   *
   * @param {string} [id=this.get('id')] - the id of the current dentist user
   * @returns {Promise<FullDentist>}
   */
  getFullDentist(id = this.get('id')) {
    let d = {};

    return Promise.resolve()
    .then(() => (
      db.User.find({
        where: {
          id,
          $or: [{
            type: 'dentist',
          }, {
            type: 'admin',
          }],
        },
        attributes: {
          exclude: userFieldsExcluded
        },
        include: [{
          model: db.DentistInfo,
          as: 'dentistInfo',
          attributes: {
            exclude: ['membershipId', 'userId', 'childMembershipId', 'createdAt', 'updatedAt'],
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
            attributes: ['id', 'dentistInfoId', 'serviceId'],
            include: [{
              model: db.Service,
              attributes: ['id', 'name'],
              as: 'service'
            }]
          }, {
            model: db.WorkingHours,
            as: 'workingHours',
            attributes: {
              exclude: ['dentistInfoId', 'createdAt', 'updatedAt'],
            },
          }, {
            model: db.DentistInfoPhotos,
            attributes: ['url'],
            as: 'officeImages'
          }]
        }, {
          model: db.Review,
          as: 'dentistReviews',
          attributes: {
            exclude: ['createdAt', 'updatedAt', 'dentistId'],
          },
          include: [{
            model: db.User,
            as: 'client',
            attributes: {
              exclude: userFieldsExcluded
            },
          }],
        }]
      })
    ))
    .then((dentist) => {
      if (dentist == null) throw new Error('No dentist found');
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
        temp.price = parseInt(i.get('price'), 10).toFixed(2);
        return temp;
      });

      d.dentistInfo.membership = d.dentistInfo.membership || {};
      d.dentistInfo.childMembership = d.dentistInfo.childMembership || {};

      // Hide anonymous reviews
      d.dentistReviews = d.dentistReviews.map((r) => {
        delete r.clientId;
        if (r.isAnonymous) delete r.client;
        return r;
      });

      // Remap services
      d.dentistInfo.services = d.dentistInfo.services.map(s => ({
        id: s.id,
        name: (s.service ? s.service.name || null : ''),
      }));

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
          d.dentistInfo.membership.savings = Math.max((cost.fullCost - (parseInt(d.dentistInfo.membership.price, 10) * 12)), 0);
        } else if (d.dentistInfo.childMembership.id === cost.membershipId) {
          d.dentistInfo.childMembership.fullCost = cost.fullCost;
          d.dentistInfo.childMembership.savings = Math.max((cost.fullCost - (parseInt(d.dentistInfo.childMembership.price, 10) * 12)), 0);
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
      // Fetch membership object
      return db.Membership.find({
        where: { id: d.dentistInfo.membership.id }
      });
    })
    .then(membership => membership.getPlanCosts())
    .then((planCosts) => {
      delete d.dentistInfo.membership.stripePlanId;
      d.dentistInfo.membership = Object.assign({}, d.dentistInfo.membership, planCosts);
      // Expand Child Membership
      return db.Membership.find({
        where: { id: d.dentistInfo.childMembership.id }
      });
    })
    .then(membership => membership.getPlanCosts())
    .then((planCosts) => {
      delete d.dentistInfo.childMembership.stripePlanId;
      d.dentistInfo.childMembership = Object.assign({}, d.dentistInfo.childMembership, planCosts);
      return Promise.resolve(d);
    });
  },

  /**
   * Gets the related payment profile of the user
   *
   * @returns {Promise<PaymentProfile>}
   */
  getPaymentProfile() {
    const userId = this.get('id');
    // 1. Find the subscription of the user
    return db.Subscription.find({
      where: { clientId: this.get('id') }
    })
    // 2. Get the payment profile
    .then((sub) => {
      if (!sub) throw new Error('User has no active subscription');
      return db.PaymentProfile.find({ where: { id: sub.paymentProfileId } });
    })
    .then((profile) => {
      if (!profile) throw new Error('User has no payment profile');
      return {
        primaryAccountHolder: (userId === profile.primaryAccountHolderId),
        stripeCustomerId: profile.stripeCustomerId,
      };
    });
  },
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
