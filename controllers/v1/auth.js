import HTTPStatus from 'http-status';
import _ from 'lodash';
import jwt from 'jsonwebtoken';
import isPlainObject from 'is-plain-object';
import passport from 'passport';
import { Router } from 'express';
import moment from 'moment';
import db from '../../models';

import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../errors';

import {
  NORMAL_USER_REGISTRATION,
  DENTIST_USER_REGISTRATION
} from '../../utils/schema-validators';

import {
  EMAIL_SUBJECTS
} from '../../config/constants';


const router = new Router();


// util methods

function createDentistInfo(user, body) {
  const dentistInfo = body.officeInfo;
  const pricing = body.pricing || {};
  const workingHours = body.workingHours || [];
  const services = body.services || [];
  const officeImages = dentistInfo.officeImages || [];

  Promise.all([
    user.createMembership({
      name: 'default membership',
      default: true,
      isActive: true,
      price: 0,
      withDiscount: pricing.treatmentDiscount || 0,
      discount: pricing.treatmentDiscount || 0,
      monthly: pricing.adultMonthlyFee,
      yearly: pricing.adultYearlyFeeActivated ?
              pricing.adultYearlyFee || null : null,
      adultYearlyFeeActivated: pricing.adultYearlyFeeActivated
    }),

    user.createMembership({
      name: 'default child membership',
      default: true,
      isActive: true,
      price: 0,
      withDiscount: pricing.treatmentDiscount || 0,
      discount: pricing.treatmentDiscount || 0,
      monthly: pricing.childMonthlyFee,
      yearly: pricing.childYearlyFeeActivated ?
              pricing.childYearlyFee || null : null,
      childYearlyFeeActivated: pricing.childYearlyFeeActivated
    })
  ])
  .then(([adult, child]) => {
    user.createDentistInfo(
      Object.assign({
        membershipId: adult.get('id'),
        childMembershipId: child.get('id')
      }, dentistInfo)
    ).then((info) => {
      workingHours.forEach(item => {
        info.createWorkingHour(item);
      });

      // create service records for the dentist.
      services.forEach(item => {
        info.createService({ serviceId: item })
          .catch(e => console.log(e));
      });

      // create pricing records for the dentist.
      db.PriceCodes.findAll({}).then(codes => {
        (pricing.codes || []).forEach(item => {
          codes.forEach(elem => {
            if (elem.code === item.code) {
              db.MembershipItem.create({
                pricingCode: elem.get('id'),
                price: item.amount,
                dentistInfoId: info.get('id')
              });
            }
          });
        });
      });

      officeImages.forEach(url => {
        db.DentistInfoPhotos.create({
          url, dentistInfoId: info.get('id')
        });
      });
    });
  });
}

// Middlewares

function normalUserSignup(req, res, next) {
  req.checkBody(NORMAL_USER_REGISTRATION);
  req.checkBody('confirmPassword', 'Password do not match').equals(req.body.password);
  req.checkBody('confirmEmail', 'Email do not match').equals(req.body.email);

  const data = req.body;

  req
    .asyncValidationErrors(true)
    .then(() => {
      data.verified = true;

      return new Promise((resolve, reject) => {
        db.User.register(data, data.password, (registerError, createdUser) => {
          if (registerError) {
            return reject(registerError);
          }
          return resolve(createdUser);
        });
      });
    })
    // .then((__user) => new Promise((resolve, reject) => {
    //   if (data.card) {
    //     return ensureCreditCard(__user, data.card)
    //       .then(user => {
    //         chargeAuthorize(user.authorizeId, user.paymentId, data)
    //           .then(() => resolve(__user))
    //           .catch(errors => {
    //             db.User.destroy({ where: { id: __user.id } });
    //             reject(errors);
    //           });
    //       })
    //       .catch((errors) => {
    //         // delete the user, account couldn't be charged successfully.
    //         db.User.destroy({ where: { id: __user.id } });
    //         reject(errors);
    //       });
    //   }
    //   return resolve(__user);
    // }))
    .then((createdUser) => {
      db.DentistInfo.find({
        attributes: ['membershipId', 'userId'],
        where: { id: data.officeId }
      })
      .then((info) => {
        const membership = data.subscription;
        const today = moment();

        db.Subscription.create({
          startAt: today,
          endAt: moment(today).add(1, 'months'),
          total: (membership.adultYearlyFeeActivated
            || membership.childYearlyFeeActivated)
            ? membership.yearly : membership.monthly,
          yearly: membership.yearly,
          monthly: membership.monthly,
          status: 'inactive',
          membershipId: membership.id,
          clientId: createdUser.id,
          dentistId: info.get('userId'),
        });
      });
      return createdUser;
    })
    .then((user) => {
      const queries = [
        user,
        // This should be created so we can edit values
      ];

      if (req.body.phone) {
        queries.push(user.createPhoneNumber({ number: req.body.phone || '' }));
      }

      if (req.body.address) {
        queries.push(user.createAddress({ value: req.body.address || '' }));
      }

      if (req.body.members) {
        req.body.members.forEach(member => {
          queries.push(db.User.addMember(member, user));
        });
      }

      return Promise.all(queries);
    })
    .then(([user]) => {
      const excludedKeys = ['hash', 'salt', 'verified', 'authorizeId',
        'paymentId', 'activationKey', 'resetPasswordKey', 'isDeleted'];

      res
        .status(HTTPStatus.CREATED)
        .json({ data: [_.omit(user, excludedKeys)] });
    })
    .catch((errors) => {
      if (isPlainObject(errors)) {
        return next(new BadRequestError(errors));
      }

      return next(errors);
    });
}


function dentistUserSignup(req, res, next) {
  const entireBody = req.body;
  req.body = entireBody.user;
  req.checkBody(DENTIST_USER_REGISTRATION);
  req.checkBody('confirmPassword', 'Password does not match').equals(req.body.password);
  req.checkBody('confirmEmail', 'Email does not match').equals(req.body.email);

  req.body = entireBody;

  req
  .asyncValidationErrors(true)
  .then(() => {
    const user = _.omit(req.body.user, ['phone']);
    user.type = 'dentist';
    user.dentistSpecialtyId = req.body.user.specialtyId;

    return new Promise((resolve, reject) => {
      db.User.register(user, user.password, (registerError, createdUser) => {
        if (registerError) {
          reject(registerError);
        } else {
          resolve(createdUser);
          createDentistInfo(createdUser, req.body);
          res.mailer.send('auth/dentist/activation_required', {
            to: user.email,
            subject: EMAIL_SUBJECTS.client.activation_required,
            site: process.env.SITE,
            user: createdUser,
          }, (err, info) => {
            if (err) {
              console.log(err);
            }

            if (process.env.NODE_ENV === 'development') {
              console.log(info);
            }
          });
        }
      });
    });
  })
  .then((user) => (
    Promise.all([
      user.createPhoneNumber({ number: req.body.user.phone }),
      // This should be created so we can edit values
      user.createAddress({ value: '' }),
    ])
  ))
  .then(() => {
    res
      .status(HTTPStatus.CREATED)
      .json({});
  })
  .catch((errors) => {
    if (isPlainObject(errors)) {
      return next(new BadRequestError(errors));
    }

    return next(errors);
  });
}


function activate(req, res, next) {
  db.User.find({ where: { activationKey: req.params.key } })
    .then((user) => {
      if (user) {
        // activate it
        return user
          .update({ verified: true, activationKey: null })
          .then(() => {
            res.mailer.send('auth/activation_complete', {
              to: user.email,
              subject: EMAIL_SUBJECTS.activation_complete,
              site: process.env.SITE,
              user,
            }, (err, info) => {
              if (err) {
                console.log(err);
              }

              if (process.env.NODE_ENV === 'development') {
                console.log(info);
              }
            });

            res.json({});
          });
      }

      return next(new NotFoundError());
    })
    .catch((errors) => {
      next(errors);
    });
}


function login(req, res, next) {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return next(new BadRequestError(null, info.message));
    }

    if (user.isDeleted) {
      return next(new NotFoundError());
    }

    if (!user.verified) {
      return next(new ForbiddenError('Account was not activated.'));
    }

    res.status(HTTPStatus.CREATED);
    const response = _.pick(user.toJSON(), ['type']);
    response.token = jwt.sign({ id: user.get('id') }, process.env.JWT_SECRET);
    return res.json(response);
  })(req, res, next);
}

/**
 * Attempts to login as an administrator
 *
 * @param {Object} req - the express request object
 * @param {Object} res - the express response object
 * @param {Function} next - call to begin the next phase of the filter chain
 */
function adminLogin(req, res, next) {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return next(new BadRequestError(null, info.message));
    if (user.isDeleted) return next(new NotFoundError());
    if (!user.verified) return next(new ForbiddenError('Account was not activated.'));
    if (user.type !== 'admin') return next(new ForbiddenError('User account is not an admin'));

    res.status(HTTPStatus.CREATED);
    const response = _.pick(user.toJSON(), ['type']);
    response.token = jwt.sign({ id: user.get('id') }, process.env.JWT_SECRET);
    return res.json(response);
  })(req, res, next);
}

// Bind with routes
router
  .route('/login')
  .post(login);

router
  .route('/admin/login')
  .post(adminLogin);

router
  .route('/logout')
  .get((req, res) => {
    res.end();
  });

router
  .route('/signup')
  .post(normalUserSignup);

// router
//   .route('/complete-signup')
//   .post(
//     passport.authenticate('jwt', { session: false }),
//     completeNormalUserSignup);

router
  .route('/dentist-signup')
  .post(dentistUserSignup);

router
  .route('/activate/:key')
  .get(activate);

module.exports = {
  auth: router,
  login,
  logout: (req, res) => res.end(),
  signup: normalUserSignup,
  dentistUserSignup,
  activate
};
