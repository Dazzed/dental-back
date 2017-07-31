/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import _ from 'lodash';
import uuid from 'uuid/v4';
import { timingSafeEqual, createHmac } from 'crypto';
import db from '../models';
import { SUBSCRIPTION_STATES_LOOKUP } from '../config/constants';

import { MembershipMethods } from '../orm-methods/memberships';
import { generateRandomEmail } from '../utils/helpers';
import stripe from '../controllers/stripe';

const userFieldsExcluded = ['hash', 'salt', 'activationKey', 'resetPasswordKey', 'verified', 'createdAt', 'updatedAt'];

const PASSWORD_RESET_TIMEOUT = 1000 * 60 * 60 * 24; // 1 day.

// ────────────────────────────────────────────────────────────────────────────────
// EXPORTS

export const instance = {

  /**
   * Retrieves details about the users subscription
   *
   * @returns {Promise<SubscriptionDetails>}
   */
  async getMySubscription() {
    const userId = this.get('id');
    let subscriptionObj = {};

    if (this.get('type') === 'dentist') {
      throw new Error('Dentist cannot have a subscription');
    }

    const sub = await db.Subscription.find({
      where: { clientId: userId },
      include: [{
        model: db.Membership,
        as: 'membership'
      }]
    })

    if (!sub || !sub.membership ) {
      return {};
    }

    subscriptionObj = sub;
    const subDetails = await sub.getStripeDetails();
    subscriptionObj.started = subDetails.start;

    const planCosts = await subscriptionObj.membership.getPlanCosts();
    return {
      costs: planCosts,
      since: subscriptionObj.started,
      status: subscriptionObj.status,
      plan: subscriptionObj.membership.name,
    };
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
  async getClients() {
    const dentistId = this.get('id');

    const subs = await db.Subscription.findAll({
        where: { dentistId },
        attributes: {
          exclude: ['paymentProfileId', 'membershipId', 'clientId', 'dentistId'],
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
            model: db.Subscription,
            as: 'clientSubscription',
            include: [{
              model: db.Membership,
              as: 'membership'
            }]
          }, {
            model: db.Review,
            as: 'clientReviews',
            attributes: { exclude: ['clientId', 'dentistId'] },
          }, {
            model: db.Address,
            as: 'addresses'
          }]
        }]
      });
     const subList = [];
      for (const sub of subs) {
        const plan = await sub.membership.getPlanCostsLocal();
        const subObj = sub.toJSON();
        subObj.membership = plan;
        subObj.client.membership = subObj.client.clientSubscription;
        subObj.client.status = subObj.client.clientSubscription.status;
        subObj.client.subscriptionId = subObj.client.clientSubscription.id;
        subObj.client.membershipId = subObj.client.clientSubscription.membership.id;
        if (subObj.client.members.length > 0 ) {
          for (const member of subObj.client.members) {
            const clientSubscription = subs.find(s => s.client.id === member.id);
            member.clientSubscription = clientSubscription;
            member.status = clientSubscription.status;
            member.membership = clientSubscription.membership;
            member.subscriptionId = clientSubscription.id;
            member.membershipId = clientSubscription.membership.id;
          }
        }
        if (subObj.client.phoneNumbers.length > 0) {
          subObj.client.phone = subObj.client.phoneNumbers[0] ? subObj.client.phoneNumbers[0].number : null;
        }
        if (subObj.client.addresses.length > 0) {
          subObj.client.address = subObj.client.addresses[0] ? subObj.client.addresses[0].value : null;
        }
        subList.push(subObj);
      }
      return subList;
  },

  /**
   * Gets associated members of this primary account
   *
   * @returns {Promise<User[]>}
   */
  async getMyMembers() {
    const users = await db.User.findAll({
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
          include: [{
            model: db.Membership,
            as: 'membership'
          }]
        }, {
          model: db.Phone,
          as: 'phoneNumbers',
        }, {
          model: db.Address,
          as: 'addresses',
        }],
        subquery: false,
      });

    const parsed = [];
    for (const user of users) {
      const subscription = await user.getMySubscription();
      const userParsed = user.toJSON();
      userParsed.subscription = subscription;
      userParsed.membershipId = userParsed.clientSubscription.membership.id;
      userParsed.phone = userParsed.phoneNumbers[0] ? userParsed.phoneNumbers[0].number : undefined;
      parsed.push(userParsed);
    }
    return parsed;
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
  createSubscription(membershipId, dentistId, transaction = null) {
    if (this.get('type') === 'dentist') {
      throw new Error('Dentist type cannot have a subscription');
    }

    let clientId = this.get('id');
    let primaryAccountHolder = this.get('addedBy') ? this.get('addedBy') : this.get('id');

    let transactionFunction = (transaction) => {
      return db.PaymentProfile.find({ where: { primaryAccountHolder } , transaction })
      .then((profile) => {
        if (!profile) throw new Error('User has no associated payment profile');
        return db.Subscription.create({
            clientId: clientId,
            membershipId: membershipId,
            dentistId: dentistId,
            paymentProfileId: profile.id,
          }, {
            transaction
        });
      })
      .catch((errors) => {
          console.log(errors);
      });
    };

    if (_.isNull(transaction)) {
      return db.sequelize.transaction(transaction => transactionFunction(transaction))
    } else {
      return transactionFunction(transaction);
    }
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
  async getFullClient(id = this.get('id')) {
    let userObj =
      await db.User.find({
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
          include:[ {
            model: db.Membership,
            as: 'membership',
          }]
        },{
          model: db.Phone,
          as: 'phoneNumbers',
        }, {
          model: db.Address,
          as: 'addresses',
        }]
      });

    if (!userObj) {
      throw new Error('User does not exist');
    }

    let user = userObj.toJSON();
    const subscription = await userObj.getMySubscription();
    user.subscription = subscription;
    return user;
  },

  /**
   * Gets the complete dentist record
   *
   * @param {string} [id=this.get('id')] - the id of the current dentist user
   * @returns {Promise<FullDentist>}
   */
  getFullDentist(id = this.get('id')) {

    let instance = this;

    // the result object.
    let d = {};

    return Promise.resolve()
    .then(() => (
      // get the dentist user with the memberships, dentistInfo (with dentistInfoService, workingHours, officeImages),
      // dentistReviews (with clients)
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
        include: [
          {
            model: db.Membership,
            as: 'memberships',
            attributes: {
              exclude: ['userId', 'dentistInfoId', 'stripePlanId'],
            },
          },
          {
            model: db.Phone,
            as: 'phoneNumbers',
          },
          {
            model: db.DentistInfo,
            as: 'dentistInfo',
            attributes: {
              exclude: ['userId', 'createdAt', 'updatedAt'],
            },
            include: [
              {
                model: db.DentistInfoService,
                as: 'services',
                attributes: ['id', 'dentistInfoId', 'serviceId'],
                include: [{
                  model: db.Service,
                  attributes: ['id', 'name'],
                  as: 'service'
                }]
              },
              {
                model: db.WorkingHours,
                as: 'workingHours',
                attributes: {
                  exclude: ['dentistInfoId', 'createdAt', 'updatedAt'],
                },
              },
              {
                model: db.DentistInfoPhotos,
                attributes: ['url'],
                as: 'officeImages'
              }
            ]
          },
          {
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
          }
        ]
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

      // Hide anonymous reviews
      d.dentistReviews = d.dentistReviews.map((r) => {
        delete r.clientId;
        if (r.isAnonymous) delete r.client;
        return r;
      });

      // Remap services
      if (d.dentistInfo.services) {
        d.dentistInfo.services = d.dentistInfo.services.map(s => ({
          id: s.id,
          name: (s.service ? s.service.name || null : ''),
        }));
      }

      return db.Subscription.count({
        where: {
          dentistId: id,
          status: SUBSCRIPTION_STATES_LOOKUP.active,
        }
      });
    })
    .then((activeMemberCount) => {
      d.dentistInfo.activeMemberCount = activeMemberCount;
    })
    .then(() => d)
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
        primaryAccountHolder: (userId === profile.primaryAccountHolder),
        stripeCustomerId: profile.stripeCustomerId,
      };
    });
  },

  /**
   * Create the password reset hash.
   */
  createPasswordResetHash(timestamp) {
    const userId = this.get('id');
    const hash = createHmac('sha256', process.env.PASSWORD_RESET_SECRET_KEY);

    hash.update([
      timestamp,
      userId,
      this.get('email'),
      this.get('hash'),
      this.get('salt')
    ].join('-'));

    return hash.digest();
  },

  /**
   * Get the password reset token.
   */
  getPasswordResetToken() {
    const now = Date.now();
    const userId = this.get('id');
    const hash = this.createPasswordResetHash(now);

    return `${now.toString(36)}.${userId.toString(36)}.${hash.toString('hex')}`;
  },

};


export const model = {

  /**
   * Check token validity.
   */
  resetPasswordTokenValidity(token) {
    const parts = token.split('.');
    const timestamp = parseInt(parts[0], 36);
    const userId = parseInt(parts[1], 36);
    const hash = Buffer.from(parts[2], 'hex');
    const valid = timestamp + PASSWORD_RESET_TIMEOUT > Date.now();

    return { valid, timestamp, userId, hash };
  },

  /**
   * Reset a user password.
   */
  resetPasswordByToken(token, newPassword) {
    const { valid, timestamp, userId, hash } = this.resetPasswordTokenValidity(token);

    if (!valid) return Promise.resolve(false);

    return db.User.find({
      where: {
        id: userId
      }
    })
      .then(user => {
        if (!user) return false

        const generated = user.createPasswordResetHash(timestamp);

        if (!timingSafeEqual(hash, generated)) return false;

        const p = new Promise((resolve, reject) => {
          return user.setPassword(newPassword, err => {
            return err ? reject(err) : resolve(true);
          });
        });

        return p.then(() => user.save()).then(() => true);
      });
  },

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
        id: memberId,
        isDeleted: false,
      },
      include: [{
        model: db.Phone,
        as: 'phoneNumbers',
      }, {
        model: db.Subscription,
        as: 'clientSubscription',
        include:[ {
          model: db.Membership,
          as: 'membership',
        }]
      }, {
        model: db.Address,
        as: 'addresses',
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

      return member.getMySubscription();
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
  addMember(data, user, transaction = null) {
    data.addedBy = user.get('id');
    data.email = _.replace(user.get('email'), '@', `${uuid()}@`);
    data.type = 'client';
    return db.User.create(data, { transaction })
    .then((member) => {
      return member.createSubscription(data.membershipId, data.dentistId, transaction)
      .then((subscription) => {
        let json = member.toJSON();
        if (subscription) {
          json.subscription = subscription.toJSON();
        }

        return json;
      });
    });
  },

  /**
   * Creates an associated member record
   * Call this when we need to add a new member to an existing subscription of a primary account holder.
   *
   * @param {object} newMember - the information of the new member
   * * @param {object} dentist - the dentist
   * @param {object} primaryMember - the parent user
   * @returns {Promise<Member>}
   */
  addAdditionalMember(newMember, dentist, primaryMember) {
    newMember = {
      ...newMember,
      addedBy: primaryMember.client.id,
      email: _.replace(primaryMember.client.email, '@', `${uuid()}@`),
      type: 'client',
    };
    return db.User.create(newMember)
    .then((member) => {
      return member.createSubscription(newMember.membershipId, dentist.id, null)
      .then((subscription) => {
        let json = member.toJSON();
        if (subscription) {
          json.subscription = subscription.toJSON();
        }

        return json;
      });
    });
  }
};
