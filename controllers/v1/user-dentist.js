import { Router } from 'express';
import passport from 'passport';
import _ from 'lodash';
import changeFactory from 'change-js';
import fetch from 'node-fetch';
import {
  APIContracts,
  APIControllers,
} from 'authorizenet';

import db from '../../models';

const Change = changeFactory();


const router = new Router({ mergeParams: true });


// create profile on authorize
/* eslint-disable max-len */
function createCustomerProfile(user) {
  const merchantAuthenticationType = new APIContracts.MerchantAuthenticationType();

  merchantAuthenticationType.setName(process.env.AUTHORIZE_NAME);
  merchantAuthenticationType.setTransactionKey(process.env.AUTHORIZE_KEY);

  const creditCard = new APIContracts.CreditCardType();
  creditCard.setCardNumber(user.cardNumber.replace(/-/g, ''));
  creditCard.setExpirationDate(user.expiry.replace('/', ''));

  const paymentType = new APIContracts.PaymentType();
  paymentType.setCreditCard(creditCard);

  const customerPaymentProfileType = new APIContracts.CustomerPaymentProfileType();
  customerPaymentProfileType.setCustomerType(APIContracts.CustomerTypeEnum.INDIVIDUAL);
  customerPaymentProfileType.setPayment(paymentType);

  const paymentProfilesList = [];
  paymentProfilesList.push(customerPaymentProfileType);

  const customerProfileType = new APIContracts.CustomerProfileType();
  customerProfileType.setMerchantCustomerId(user.id);
  customerProfileType.setEmail(user.email);
  customerProfileType.setPaymentProfiles(paymentProfilesList);

  const createRequest = new APIContracts.CreateCustomerProfileRequest();
  createRequest.setProfile(customerProfileType);
  createRequest.setMerchantAuthentication(merchantAuthenticationType);

  if (process.env.NODE_ENV !== 'production') {
    createRequest.setValidationMode(APIContracts.ValidationModeEnum.TESTMODE);
  }

  const ctrl =
    new APIControllers.CreateCustomerProfileController(createRequest.getJSON());

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response =
        new APIContracts.CreateCustomerProfileResponse(apiResponse);

      if (response != null) {
        if (response.getMessages().getResultCode() == APIContracts.MessageTypeEnum.OK) {  // eslint-disable-line
          resolve(response.getCustomerProfileId());
        } else {
          const reason = {
            resultCode: response.getMessages().getResultCode(),
            errorCode: response.getMessages().getMessage()[0].getCode(),
            errorMessage: response.getMessages().getMessage()[0].getText(),
          };

          const error = new Error(reason.errorMessage);
          error.json = reason;

          reject(error);
        }
      } else {
        reject(new Error('No content'));
      }
    });
  });
}


function generateToken(user) {
  const merchantAuthenticationType = new APIContracts.MerchantAuthenticationType();
  merchantAuthenticationType.setName(process.env.AUTHORIZE_NAME);
  merchantAuthenticationType.setTransactionKey(process.env.AUTHORIZE_KEY);

  const setting = new APIContracts.SettingType();
  setting.setSettingName('hostedProfileReturnUrl');
  setting.setSettingValue(`${process.env.SITE}payment/done`);

  const settingList = [];
  settingList.push(setting);

  const alist = new APIContracts.ArrayOfSetting();
  alist.setSetting(settingList);

  const getRequest = new APIContracts.GetHostedProfilePageRequest();
  getRequest.setMerchantAuthentication(merchantAuthenticationType);
  getRequest.setCustomerProfileId(user.authorizeId);
  getRequest.setHostedProfileSettings(alist);

  const ctrl = new APIControllers.GetHostedProfilePageController(getRequest.getJSON());

  return new Promise((resolve, reject) => {
    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new APIContracts.GetHostedProfilePageResponse(apiResponse);

      if (response !== null) {
        if (response.getMessages().getResultCode() === APIContracts.MessageTypeEnum.OK) {
          resolve(response.getToken());
        } else {
          const reason = {
            errorCode: response.getMessages().getMessage()[0].getCode(),
            errorMessage: response.getMessages().getMessage()[0].getText(),
          };

          const error = new Error(reason.errorMessage);
          error.json = reason;

          reject(error);
        }
      } else {
        reject(new Error('No content'));
      }
    });
  });
}

/* eslint-enable */


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
    attributes: ['id', 'firstName', 'lastName', 'birthDate', 'avatar', 'email',
      'createdAt', 'contactMethod', 'payingMember'],
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
        payingMember: item.payingMember,
        lastName: item.lastName,
        birthDate: item.birthDate,
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
    include: [{
      attributes: ['payingMember'],
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
      const memberSubscriptions = [];
      let total = new Change({
        dollars: subscription.get('client').get('payingMember') ?
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


/**
 * Return token to charge bill.
 *
 */
function getAuthorizeToken(req, res, next) {
  let userId = req.params.userId;

  if (userId === 'me') {
    userId = req.user.get('id');
  }

  db.User.find({
    where: { id: userId },
    attributes: ['authorizeId', 'id', 'email'],
    raw: true,
  }).then((user) => {
    if (!user.authorizeId) {
      user.cardNumber = req.body.cardNumber;
      user.expiry = req.body.expiry;
      return createCustomerProfile(user).then((id) => {
        db.User.update({ authorizeId: id }, { where: { id: userId } });
        user.authorizeId = id;
        return user;
      });
    }
    return user;
  }).then(user => generateToken(user)
  ).then((token) => {
    res.json({ data: { token } });
  })
    .catch(next);
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
  .route('/authorize-token')
  .post(
    passport.authenticate('jwt', { session: false }),
    getAuthorizeToken);

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


router
  .route('/reports')
  .get(
    passport.authenticate('jwt', { session: false }),
    generateReport);


export default router;

