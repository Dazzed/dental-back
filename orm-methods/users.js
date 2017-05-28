import moment from 'moment';
import _ from 'lodash';
import db from '../models';

import { MembershipMethods } from '../orm-methods/memberships';

import {
  generateRandomEmail
} from '../utils/helpers';

const userFieldsExcluded = ['hash', 'salt', 'activationKey', 'resetPasswordKey', 'verified'];

export const instance = {

  getSubscriptions() {
    // TODO: Fix ability to get subscriptions with Stripe
    const where = {
      isDeleted: false,
      $or: [{
        addedBy: this.get('id'),
      }, {
        id: this.get('id'),
        payingMember: true,
      }],
    };

    return db.Subscription.findAll({
      attributes: ['total', 'type', 'id'],
      where: { status: 'inactive' },
      include: [{
        model: db.User,
        as: 'client',
        attributes: ['id'],
        where,
      }]
    });
  },

  getDentistReviews() {
    return db.Review.findAll({
      where: { dentistId: this.get('id') },
      attributes: { exclude: ['clientId', 'dentistId'] }
    });
  },

  /**
   * Method that returs all clients and subscriptions
   *
   * This parses all clients and return data to be displayed.
   */
  getClients() {
    return db.User.findAll({
      attributes: { exclude: userFieldsExcluded },
      where: {
        addedBy: null,
        isDeleted: false,
      },
      include: [{
        model: db.Subscription,
        as: 'clientSubscription',
        where: {
          dentistId: this.get('id'),
          status: { $not: 'canceled' },
        },
      }, {
        model: db.User,
        as: 'members',
        required: false,
        attributes: { exclude: userFieldsExcluded },
        where: { isDeleted: false },
        include: [{
          model: db.Subscription,
          where: { dentistId: this.get('id') },
          as: 'clientSubscription',
          order: '"status" DESC',
          limit: 1,
        }, {
          model: db.Phone,
          as: 'phoneNumbers',
        }],
      }, {
        as: 'clientReviews',
        model: db.Review,
        attributes: { exclude: ['clientId', 'dentistId'] },
      }, {
        model: db.Phone,
        as: 'phoneNumbers',
      }],
      subquery: false,
    }).then(result => result.map(item => {
      const parsed = item.toJSON();

      parsed.subscription = parsed.clientSubscription;

      parsed.reviews = parsed.clientReviews;
      delete parsed.clientReviews;

      parsed.phone = parsed.phoneNumbers[0] ?
        parsed.phoneNumbers[0].number : undefined;
      delete parsed.phoneNumbers;

      parsed.members.forEach(member => {
        member.subscription = member.clientSubscriptions[0];
        delete member.clientSubscriptions;
        member.phone = member.phoneNumbers[0] ?
          member.phoneNumbers[0].number : undefined;
        delete member.phoneNumbers;
      });

      if (parsed.payingMember) {
        const self = Object.assign({}, parsed);
        delete self.clientReviews;
        delete self.members;
        parsed.members.splice(0, 0, self);
      }

      return parsed;
    }));
  },

  getCurrentSubscription() {
    const query = {};

    if (this.get('type') === 'dentist') {
      throw new Error('Dentist cannot have a subscription');
    } else {
      query.clientId = this.get('id');
    }

    return db.Subscription.find({
      where: query,
      order: '"status" DESC',
    });
  },

  getMyMembers() {
    return db.User.findAll({
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
        // TODO: add monthly cost back from Stripe?
        attributes: ['name'],
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
    }).then(result => result.map(item => {
      const parsed = item.toJSON();

      parsed.subscription = parsed.clientSubscription;

      parsed.phone = parsed.phoneNumbers[0] ?
        parsed.phoneNumbers[0].number : undefined;
      delete parsed.phoneNumbers;

      return parsed;
    }));
  },


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
          as: 'membership',
          // TODO: need default, total, type?
          attributes: ['name'],
          // attributes: ['name', 'default', 'total', 'type'],
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

    return db.User.find(query).then(dentist => {
      const parsed = dentist ? dentist.toJSON() : {};

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
        .forEach(review => {
          delete review.clientId;
          delete review.dentistId;
        });
      parsed.dentistReviews = reviews;
      return [parsed, dentist];
    });
  },

  /**
   * Creates a new subscription record
   *
   * @param {object} membership - the membership to subscribe to
   * @param {number} dentistId - the ID of the dentist providing the membership
   * @param {object} t - the sequelize transaction
   * @returns {Promise<Subscription>}
   */
  createSubscription(membership, dentistId, t) {
    if (this.get('type') === 'dentist') {
      throw new Error('Dentist type cannot create subscription');
    }

    // TODO: Create Stripe Subscription
    return db.Subscription.create({
      status: 'inactive',
      membershipId: membership.id,
      clientId: this.get('id'),
      dentistId,
    }, { transaction: t });
  },

  createNotification(data) {
    return db.Notification.create(
      Object.assign(data, {
        recipientId: this.get('id')
      })
    );
  },

  getFullDentist(id = this.get('id')) {
    let d = {};

    return Promise.resolve().then(() => {
      return db.User.find({
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
      });
    })
    .then(dentist => {
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
    .then(items => {
      d.dentistInfo = d.dentistInfo || {};
      d.dentistInfo.priceCodes = items.map(i => {
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
    .then(fullCosts => {
      fullCosts.forEach(cost => {
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
    .then(activeMemberCount => {
      d.dentistInfo.activeMemberCount = activeMemberCount;
      return Promise.resolve(d);
    });
  }
};


export const model = {

  getMyMember(addedBy, memberId) {
    return db.User.find({
      attributes: { exclude: userFieldsExcluded },
      where: {
        addedBy,
        id: memberId,
        isDeleted: false,
      },
      include: [{
        model: db.Subscription,
        as: 'clientSubscription',
        limit: 1,
        order: '"status" DESC',
      }, {
        model: db.Phone,
        as: 'phoneNumbers',
      }],
      subquery: false,
    }).then(member => {
      const parsed = member ? member.toJSON() : undefined;

      if (member) {
        parsed.subscription = parsed.clientSubscription;

        parsed.phone = parsed.phoneNumbers[0] ?
          parsed.phoneNumbers[0].number : undefined;
        delete parsed.phoneNumbers;
      }

      return parsed;
    });
  },

  /**
   * Creates an associated member record
   *
   * @param {object} data - the information of the new member
   * @param {object} user - the parent user
   * @param {object} t - the sequelize transaction object
   * @returns {Promise<Member>}
   */
  addMember(data, user, t = null) {
    const membership = data.subscription;
    let member;

    data.addedBy = user.get('id');
    data.hash = 'NOT_SET';
    data.salt = 'NOT_SET';
    data.type = 'client';
    // FIXME: Why generate a random email?
    data.email = generateRandomEmail();

    return Promise.resolve()
    .then(() => db.User.create(data, { transaction: t }))
    .then((_member) => {
      member = _member;
      return db.Subscription.find({
        attributes: ['dentistId', 'id'],
        where: { clientId: user.get('id') },
        raw: true
      }, { transaction: t });
    })
    .then(subscription => member.createSubscription(membership, subscription.dentistId, t))
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
