/* eslint max-len:0 */

// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import _ from 'lodash';

import db from '../../models';

import { userRequired, injectDentistInfo } from '../middlewares';
import { MembershipMethods } from '../../orm-methods/memberships';
import { SUBSCRIPTION_STATES_LOOKUP } from '../../config/constants';

import {
  ForbiddenError,
  BadRequestError,
} from '../errors';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets the dentist info record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the express next request handler
 */
function getDentistInfo(req, res, next) {
  let dentistInfo = req.locals.dentistInfo.toJSON();
  const userId = req.user.get('type') === 'admin' ? req.params.userId : req.user.get('id');
  dentistInfo = _.omit(dentistInfo, ['membershipId', 'childMembershipId', 'pricing']);

  return Promise.resolve()
  .then(() => (
    db.MembershipItem.findAll({
      where: { dentistInfoId: dentistInfo.id },
      include: [{
        model: db.PriceCodes,
        as: 'priceCode'
      }]
    })
  ))
  .then((items) => {
    // Inject the price codes
    dentistInfo.priceCodes = items.map((i) => {
      const temp = i.priceCode.toJSON();
      temp.price = i.get('price');
      return i.priceCode;
    });

    // Unwrap the services
    dentistInfo.services = dentistInfo.services.map(item => item.service);

    return db.Subscription.count({
      where: {
        dentistId: userId,
        status: SUBSCRIPTION_STATES_LOOKUP.active,
      }
    });
  })
  .then((activeMemberCount) => {
    // Inject active member counts
    dentistInfo.activeMemberCount = activeMemberCount;

    if (req.user.get('type') === 'dentist') {
      res.json({
        data: dentistInfo
      });
    } else {
      const data = req.user.toJSON();
      data.dentistInfo = dentistInfo;
      res.json({ data });
    }
  })
  .catch(err => next(new BadRequestError(err)));
}

/**
 * Updates the dentist info record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
function updateDentistInfo(req, res, next) {
  const userId = req.params.dentistInfoId;

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

  return Promise.resolve()
  .then(() => db.DentistInfo.find(query))
  .then((dentistInfo) => {
    if (dentistInfo == null) {
      return next(new BadRequestError('No dentist info object was found'));
    }

    const queries = [];
    const user = req.body.user;
    const officeInfo = req.body.officeInfo;
    const officeImages = req.body.officeImages;
    const pricing = req.body.pricing;
    const membership = req.body.membership;
    const childMembership = req.body.childMembership;
    const workingHours = req.body.workingHours;
    const services = req.body.services;

    if (user) {
      queries.push(
        req.user.update({
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          avatar: user.avatar,
          zipCode: user.zipCode,
          dentistSpecialtyId: user.dentistSpecialtyId
        })
      );
    }

    // update info itself.
    if (officeInfo) {
      queries.push(
        dentistInfo.update({
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
        })
      );
    }

    if (pricing.codes) {
      // update pricing codes.
      pricing.codes.forEach((item) => {
        queries.push(
          db.MembershipItem.update({
            price: item.price,
          }, {
            where: {
              id: item.id,
            }
          }))
      });
    }

    // TODO(sameep): Fix dentist edit form for memberships.
    // if (membership) {
    //   // Update membership plans on Stripe + DB
    //   queries.push(
    //     db.Membership.update({
    //       price: membership.price,
    //       discount: membership.discount,
    //     }, {
    //       where: { id: dentistInfo.get('membershipId') },
    //       individualHooks: true,
    //     })
    //   );
    // }
    //
    // if (childMembership) {
    //   // update child membership.
    //   queries.push(
    //     db.Membership.update({
    //       price: childMembership.price,
    //       discount: childMembership.discount,
    //     }, {
    //       where: { id: dentistInfo.get('childMembershipId') },
    //       individualHooks: true,
    //     })
    //   );
    // }

    if (user.phone) {
      queries.push(
        db.Phone.update({
          number: user.phone,
        }, {
          where: {
            userId: dentistInfo.get('id'),
          }
        })
      );
    }

    if (workingHours) {
      // update working hours
      workingHours.forEach((workingHour) => {
        queries.push(
          db.WorkingHours.update({
            isOpen: workingHour.isOpen,
            startAt: workingHour.startAt,
            endAt: workingHour.endAt,
          }, {
            where: {
              dentistInfoId: dentistInfo.get('id'),
              day: workingHour.day,
            }
          })
        );
      });
    }

    if (services) {
      // update services.
      for (let service in services) {  // eslint-disable-line
        const id = parseInt(service.replace(/[^0-9.]/g, ''), 10);
        const shouldAdd = services[service];

        if (shouldAdd) {
          queries.push(dentistInfo.addService(id));
        } else {
          queries.push(dentistInfo.removeService(id));
        }
      }
    }

    if (officeImages) {
      // update office images.
      officeImages.forEach((imageUrl) => {
        queries.push(
          db.DentistInfoPhotos.upsert({
            url: imageUrl,
            dentistInfoId: dentistInfo.get('id')
          })
        );
      });
    }

    return Promise.all(queries).then(() => res.json({}));
  })
  .catch((err) => {
    return next(new BadRequestError(err));
  });
}

/**
 * Delete a dentist image.
 */
function deleteDentistInfoPhoto (req, res, next) {
  return db.DentistInfo.find({ id: req.params.dentistInfoId })
    .then((dentistInfo) => {
      if (!dentistInfo) {
        return false;
      }

      return dentistInfo.get('userId') === req.user.get('id');
    })
    .then((isDentistOwner) => {
      if (!isDentistOwner) {
        return Promise.reject(new ForbiddenError('Not the dentist owner'));
      }

      return db.DentistInfoPhotos.destroy({
        where: {
          id: req.params.dentistInfoPhotoId,
          dentistInfoId: req.params.dentistInfoId,
        }
      }).then((result) => res.json({ result }));
    })
    .catch(next);
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(
    userRequired,
    injectDentistInfo(),
    getDentistInfo);

router
  .route('/:dentistInfoId/photos/:dentistInfoPhotoId')
  .delete(
    userRequired,
    deleteDentistInfoPhoto);

router
  .route('/:dentistInfoId')
  .post(
    userRequired,
    updateDentistInfo);

export default router;
