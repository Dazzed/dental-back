import moment from 'moment';
import db from '../models';


export const instance = {

  /**
   * Method that returs all clients and subscriptions
   *
   * This parses all clients and return data to be displayed.
   */
  getClients() {
    const userFieldsExcluded = ['hash', 'salt', 'activationKey',
      'resetPasswordKey', 'verified'];

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
    const userFieldsExcluded = ['hash', 'salt', 'activationKey',
      'resetPasswordKey', 'verified'];

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


  getMyDentist() {
    return db.User.find({
      attributes: ['id', 'firstName', 'lastName', 'avatar'],
      include: [{
        as: 'dentistSubscriptions',
        model: db.Subscription,
        where: { status: { $not: 'canceled' }, clientId: this.get('id') },
        include: [{
          attributes: ['name', 'default', 'monthly'],
          model: db.Membership,
        }]
      }, {
        model: db.Review,
        as: 'dentistReviews',
        attributes: ['rating']
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
        }]
      }],
      subquery: false,
      loggin: console.log,
    }).then(dentist => {
      const parsed = dentist ? dentist.toJSON() : {};
      // parsed.subscription = parsed.dentistSubscriptions[0];
      delete parsed.dentistSubscriptions;
      return parsed;
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
      total: membership.price,
      monthly: membership.monthly,
      membershipId: membership.id,
      clientId: this.get('id'),
      dentistId,
    });
  }
};


export const model = {

  getMyMember(addedBy, memberId) {
    const userFieldsExcluded = ['hash', 'salt', 'activationKey',
      'resetPasswordKey', 'verified'];

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
      const parsed = member.toJSON();

      parsed.subscription = parsed.clientSubscriptions[0];
      delete parsed.clientSubscriptions;

      parsed.phone = parsed.phoneNumbers[0] ?
        parsed.phoneNumbers[0].number : undefined;
      delete parsed.phoneNumbers;

      return parsed;
    });
  },

};
