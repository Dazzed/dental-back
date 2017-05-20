/* eslint max-len:0 */

// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import _ from 'lodash';

import db from '../../models';
import { userRequired } from '../middlewares';
import { updateTotalMembership } from '../../utils/helpers';
import { MembershipMethods } from '../../orm-methods/memberships';

import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Fills the request with the dentist information from
 * the requested member found in the url params
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function getDentistInfoFromParams(req, res, next) {
  const userId = req.params.userId;

  /*
   * If user is not admin and try to requests paths not related
   * to that user will return forbidden.
   */
  const canEdit =
    userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
    (req.user.get('type') === 'admin' && userId !== 'me');

  if (!canEdit) {
    return next(new ForbiddenError());
  }

  const query = {
    where: {},
    attributes: {
      exclude: ['userId'],
    },
    include: [{
      model: db.WorkingHours,
      as: 'workingHours',
      attributes: { exclude: ['dentistInfoId'] },
      orderBy: 'createdAt DESC',
    }, {
      model: db.MembershipItem,
      as: 'pricing',
      attributes: {
        exclude: ['dentistInfoId']
      }
    }, {
      model: db.Membership,
      as: 'membership',
      attributes: {
        exclude: ['isDeleted', 'default', 'userId'],
      },
      // include: [{
      //   model: db.MembershipItem,
      //   as: 'items',
      //   attributes: {
      //     exclude: ['membershipId'],
      //   },
      // }],
    }, {
      model: db.Membership,
      as: 'childMembership',
      attributes: {
        exclude: ['isDeleted', 'default', 'userId'],
      },
      // include: [{
      //   model: db.MembershipItem,
      //   as: 'items',
      //   attributes: {
      //     exclude: ['membershipId'],
      //   },
      // }],
    }, {
      model: db.DentistInfoService,
      as: 'services',
      attributes: {
        exclude: ['serviceId', 'dentistInfoId']
      },
      include: [{
        model: db.Service,
        as: 'service',
        raw: true
      }]
    }, {
      model: db.DentistInfoPhotos,
      as: 'officeImages',
      attributes: ['url']
    }],
    order: [
      [
        { model: db.Membership, as: 'membership' },
        // { model: db.MembershipItem, as: 'items' },
        'id', 'asc'
      ],
      [
        { model: db.Membership, as: 'childMembership' },
        // { model: db.MembershipItem, as: 'items' },
        'id', 'asc'
      ]
    ]
  };

  if (req.params.dentistInfoId) {
    query.where.id = req.params.dentistInfoId;
  }

  // if not admin limit query to related data userId
  if (req.user.get('type') !== 'admin') {
    query.where.userId = req.user.get('id');
  }

  // console.log(query);
  return db.DentistInfo.find(query).then((dentistInfo) => {
    if (!dentistInfo) {
      return next(new NotFoundError());
    }

    req.locals.dentistInfo = dentistInfo;

    return next();
  }).catch((error) => {
    next(error);
  });
}

/**
 * Updates the dentist info record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function updateDentistInfo(req, res, next) {
  const userId = req.params.userId;

  /*
   * If user is not admin and try to requests paths not related
   * to that user will return forbidden.
   */
  const canEdit =
    userId === 'me' || req.user.get('id') === parseInt(userId, 10) ||
    (req.user.get('type') === 'admin' && userId !== 'me');

  if (!canEdit) {
    return next(new ForbiddenError());
  }

  const query = {
    where: {},
    include: [{
      model: db.DentistInfoPhotos,
      as: 'officeImages'
    }]
  };

  if (req.params.dentistInfoId) {
    query.where.id = req.params.dentistInfoId;
  }

  // if not admin limit query to related data userId
  if (req.user.get('type') !== 'admin') {
    query.where.userId = req.user.get('id');
  }

  // Update dentinst info
  return db.DentistInfo
    .find(query)
    .then((info) => {
      const queries = [];
      const user = req.body.user;
      const officeInfo = req.body.officeInfo;
      const officeImages = officeInfo.officeImages;
      const pricing = req.body.pricing;
      const membership = req.body.membership;
      const childMembership = req.body.childMembership;
      const workingHours = req.body.workingHours;
      const services = req.body.services;

      queries.push(
        req.user.update({
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          avatar: user.avatar,
          zipCode: user.zipCode,
          specialtyId: user.specialtyId
        })
      );

      // update info itself.
      queries.push(info.update({
        officeName: officeInfo.officeName,
        url: officeInfo.url,
        phone: officeInfo.phone,
        message: officeInfo.message,
        address: officeInfo.address,
        city: officeInfo.city,
        state: officeInfo.state,
        zipCode: officeInfo.zipCode,
        logo: officeInfo.logo,
        acceptsChildren: officeInfo.acceptsChildren,
        childStartingAge: officeInfo.childStartingAge,
        marketplaceOptIn: officeInfo.marketplaceOptIn
      }));

      if (pricing) {
        // update pricing codes.
        pricing.codes.forEach(item => {
          queries.push(db.MembershipItem.update({
            price: item.amount,
          }, {
            where: {
              dentistInfoId: info.get('id'),
              pricingCode: item.code,
            },
          }).then(obj => {
            if (obj[0] === 0) {
              return db.MembershipItem.create({
                pricingCode: item.code,
                price: item.amount,
                dentistInfoId: info.get('id')
              });
            }
            return obj;
          }));
        });
      }

      if (membership) {
        updateTotalMembership(membership);

        // update adult membership.
        queries.push(db.Membership.update({
          recommendedFee: membership.recommendedFee,
          activationCode: membership.activationCode,
          discount: membership.discount,
          price: membership.price,
          withDiscount: membership.withDiscount,
          monthly: membership.monthly,
        }, { where: { id: info.get('membershipId') } }));
      }

      if (childMembership) {
        // // update child membership items
        // childMembership.items.forEach(item => {
        //   queries.push(db.MembershipItem.update({
        //     price: item.amount,
        //   }, {
        //     where: {
        //       membershipId: info.get('childMembershipId'),
        //       pricingCode: item.pricingCode,
        //     },
        //   }));
        // });

        updateTotalMembership(childMembership);

        // update child membership.
        queries.push(db.Membership.update({
          recommendedFee: childMembership.recommendedFee,
          activationCode: childMembership.activationCode,
          discount: childMembership.discount,
          price: childMembership.price,
          withDiscount: childMembership.withDiscount,
          monthly: childMembership.monthly,
        }, { where: { id: info.get('childMembershipId') } }));
      }


      if (workingHours) {
        // update working hours
        workingHours.forEach(workingHour => {
          queries.push(db.WorkingHours.update({
            isOpen: workingHour.isOpen,
            startAt: workingHour.startAt,
            endAt: workingHour.endAt,
          }, {
            where: {
              dentistInfoId: info.get('id'),
              day: workingHour.day,
            },
          }));
        });
      }

      if (services) {
        // update services.
        for (let service in services) {  // eslint-disable-line
          const id = parseInt(service.replace(/[^0-9.]/g, ''), 10);
          const shouldAdd = services[service];

          if (shouldAdd) {
            queries.push(info.addService(id));
          } else {
            queries.push(info.removeService(id));
          }
        }
      }

      if (officeImages) {
        const existingImages = info.get('officeImages');

        // update office images.
        officeImages.forEach(imageUrl => {
          if (!existingImages.find(image => image.url === imageUrl)) {
            queries.push(
              db.DentistInfoPhotos.create({
                url: imageUrl,
                dentistInfoId: info.get('id')
              })
            );
          }
        });
      }

      return Promise.all(queries);
    }).then(() => {
      next();
    }).catch(next);
}

/**
 * Gets the dentist info record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getDentistInfo(req, res) {
  let dentistInfo = req.locals.dentistInfo.toJSON();
  dentistInfo = _.omit(dentistInfo, ['membershipId', 'childMembershipId']);

  db.MembershipItem.findAll({
    where: { dentistInfoId: dentistInfo.id },
    include: [{
      model: db.PriceCodes,
      as: 'priceCode'
    }]
  }).then(items => {
    delete dentistInfo.pricing;
    dentistInfo.priceCodes = items.map(i => {
      const temp = i.priceCode.toJSON();
      temp.price = i.get('price');
      return i.priceCode;
    });
    dentistInfo.services = dentistInfo.services.map(item => item.service);

    // Calculate membership costs
    MembershipMethods
    .calculateCosts(dentistInfo.id, [
      dentistInfo.membership.id,
      dentistInfo.childMembership.id,
    ])
    .then(fullCosts => {
      fullCosts.forEach(cost => {
        if (dentistInfo.membership.id === cost.membershipId) {
          dentistInfo.membership.fullCost = cost.fullCost;
          dentistInfo.membership.savings = (cost.fullCost - (parseInt(dentistInfo.membership.price, 10) * 12));
        } else if (dentistInfo.childMembership.id === cost.membershipId) {
          dentistInfo.childMembership.fullCost = cost.fullCost;
          dentistInfo.childMembership.savings = (cost.fullCost - (parseInt(dentistInfo.childMembership.price, 10) * 12));
        }
      });

      // Determine # of active members
      db.Subscription.count({
        where: {
          dentistId: req.user.get('id'),
          status: 'active',
        }
      }).then(activeMemberCount => {
        dentistInfo.activeMemberCount = activeMemberCount;

        if (req.user.get('type') === 'dentist') {
          res.json({
            data: dentistInfo
          });
        } else {
          const user = _.omit(req.user.toJSON(), ['authorizeId', 'paymentId']);
          user.dentistInfo = dentistInfo;

          res.json({
            data: user
          });
        }
      }).catch(err => { throw new Error(err); });
    });
  }).catch(err => new BadRequestError(err));
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    userRequired,
    getDentistInfoFromParams,
    getDentistInfo);

router
  .route('/:dentistInfoId?')
  .post(
    userRequired,
    updateDentistInfo,
    getDentistInfoFromParams,
    getDentistInfo);

export default router;
