import moment from 'moment';
import _ from 'lodash';
import db from '../models';

import { MembershipMethods } from '../orm-methods/memberships';

import {
  generateRandomEmail
} from '../utils/helpers';

const userFieldsExcluded = ['hash', 'salt', 'activationKey',
  'resetPasswordKey', 'verified', 'authorizeId', 'paymentId'];


export const instance = {

  getSubscriptions() {
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
      attributes: ['monthly', 'id'],
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
        as: 'clientSubscriptions',
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
          as: 'clientSubscriptions',
          order: '"createdAt" DESC',
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

      parsed.subscription = parsed.clientSubscriptions[0];
      delete parsed.clientSubscriptions;

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
      order: '"createdAt" DESC',
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
          payingMember: true,
        }],
        isDeleted: false,
      },
      include: [{
        attributes: ['name', 'default', 'monthly'],
        model: db.Membership,
        as: 'memberships'
      }, {
        model: db.Subscription,
        as: 'clientSubscriptions',
        limit: 1,
        order: '"createdAt" DESC',
      }, {
        model: db.Phone,
        as: 'phoneNumbers',
      }],
      subquery: false,
    }).then(result => result.map(item => {
      const parsed = item.toJSON();

      parsed.subscription = parsed.clientSubscriptions[0];
      delete parsed.clientSubscriptions;

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
        as: 'dentistSubscriptions',
        where: { status: { $not: 'canceled' }, clientId: this.get('id') },
        include: [{
          model: db.Membership,
          as: 'membership',
          attributes: ['name', 'default', 'monthly'],
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
            exclude: ['isDeleted', 'default', 'userId'],
          },
        }, {
          model: db.Membership,
          as: 'childMembership',
          attributes: {
            exclude: ['isDeleted', 'default', 'userId'],
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

  createSubscription(membership, dentistId) {
    if (this.get('type') === 'dentist') {
      throw new Error('Dentist type cannot create subscription');
    }

    const today = moment();

    return db.Subscription.create({
      startAt: today,
      endAt: today.add(1, 'months'),
      total: (membership.adultYearlyFeeActivated
        || membership.childYearlyFeeActivated)
        ? membership.yearly : membership.monthly,
      yearly: membership.yearly,
      monthly: membership.monthly,
      status: 'inactive',
      membershipId: membership.id,
      clientId: this.get('id'),
      dentistId,
    });
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
              exclude: ['isDeleted', 'default', 'userId'],
            },
          }, {
            model: db.Membership,
            as: 'childMembership',
            attributes: {
              exclude: ['isDeleted', 'default', 'userId'],
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
      // Retrieve Price Codes
      return db.MembershipItem.findAll({
        where: { dentistInfoId: d.dentistInfo.id },
        include: [{
          model: db.PriceCodes,
          as: 'priceCode'
        }]
      });
    })
    .then(items => {
      d.dentistInfo.priceCodes = items.map(i => {
        const temp = i.priceCode.toJSON();
        temp.price = i.get('price');
        return i.priceCode;
      });
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
        as: 'clientSubscriptions',
        limit: 1,
        order: '"createdAt" DESC',
      }, {
        model: db.Phone,
        as: 'phoneNumbers',
      }],
      subquery: false,
    }).then(member => {
      const parsed = member ? member.toJSON() : undefined;

      if (member) {
        parsed.subscription = parsed.clientSubscriptions[0];
        delete parsed.clientSubscriptions;

        parsed.phone = parsed.phoneNumbers[0] ?
          parsed.phoneNumbers[0].number : undefined;
        delete parsed.phoneNumbers;
      }

      return parsed;
    });
  },

  addMember(data, user) {
    const membership = data.subscription;
    let member;

    data.addedBy = user.get('id');
    data.hash = 'NOT_SET';
    data.salt = 'NOT_SET';
    data.type = 'client';
    data.email = generateRandomEmail();

    return new Promise((resolve, reject) => {
      db.User.create(data)
      .then(_member => {
        member = _member;
        return db.Subscription.find({
          attributes: ['dentistId', 'id'],
          where: { clientId: user.get('id') },
          raw: true
        });
      })
      .then(subscription =>
        member.createSubscription(membership, subscription.dentistId)
      )
      .then(subscription => {
        const response = member.toJSON();
        response.membership = membership;
        response.subscription = subscription.toJSON();

        resolve(
          _.omit(response, ['salt', 'hash', 'dentistSpecialtyId',
            'authorizeId', 'isDeleted', 'paymentId', 'resetPasswordKey', 'verified'
          ])
        );
      })
      .catch(error => reject(error));
    });
  }
};
