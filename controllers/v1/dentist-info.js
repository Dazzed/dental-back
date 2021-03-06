/* eslint max-len:0 */

// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';
import _ from 'lodash';
import async from 'async';
import db from '../../models';

import { userRequired, injectDentistInfo, dentistRequired } from '../middlewares';
import { MembershipMethods } from '../../orm-methods/memberships';
import { SUBSCRIPTION_STATES_LOOKUP } from '../../config/constants';

import {
  ForbiddenError,
  BadRequestError,
} from '../errors';

import { processDiff } from '../../utils/compareUtils';
import { notifyPlanUpdate } from '../../helpers/membership';
import { deleteObjectInS3 } from '../../helpers/dentist-info';
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
      req.dentistInfoResult = {
        data: dentistInfo,
        stripe_public_key: process.env.STRIPE_PUBLIC_KEY
      };
      next();
    } else {
      const data = req.user.toJSON();
      data.dentistInfo = dentistInfo;
      req.dentistInfoResult = {
        data,
        stripe_public_key: process.env.STRIPE_PUBLIC_KEY
      };
      next();
    }
  })
  .catch(err => next(new BadRequestError(err)));
}

async function getCustomMembership (req, res) {
  const dentistInfo = req.dentistInfoResult.data;
  if (req.query.custom_plans) {
    const custom_memberships = await db.Membership.findAll({
      where: {
        dentistInfoId: dentistInfo.id,
        active: true,
        type: 'custom'
      },
      include: [{
        model: db.CustomMembershipItem,
        as: 'custom_items'
      }]
    }).map(m => m.toJSON());
    req.dentistInfoResult.data.custom_memberships = custom_memberships;
  }
  
  return res.status(200).send({ ...req.dentistInfoResult });
}

/**
 * Updates the dentist info record
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 * @param {Function} next - the next middleware function
 */
async function updateDentistInfo(req, res, next) {
  const userId = req.params.dentistId;

  const { dentistInfo } = req.locals;
  const queries = [];
  const user = req.body.user;
  const officeInfo = req.body.officeInfo;
  const officeImages = req.body.officeImages;
  const pricing = req.body.pricing;
  const membership = req.body.officeInfo.memberships;
  const childMembership = req.body.childMembership;
  const workingHours = req.body.workingHours;
  const services = req.body.services;

  let shouldRefresh = false;

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
            pricingCodeId: item.id,
            dentistInfoId: dentistInfo.id,
          }
        }))
    });
  }

  if (pricing) {
    const currentMemberships = req.locals.dentistInfo.memberships.map(m => m.toJSON());
    const alteredMemberships = [];
    for (const key in pricing) {
      if (key !== "codes") {
        alteredMemberships.push(pricing[key]);
      }
    }
    currentMemberships.forEach(cm => {
      const alteredMembership = alteredMemberships.find(am => am.id === cm.id);
      if (alteredMembership) {
        if (cm.price !== alteredMembership.value) {
          shouldRefresh = true;
          // Disable old membership
          queries.push(
            db.Membership.update({
              active: false
            },
            {
              where: {
                id: cm.id
              }
            })
          );
          // Create New membership
          queries.push(
            db.Membership.create({
              name: cm.name,
              userId: user.id,
              discount: cm.discount,
              price: alteredMembership.value,
              type: cm.type,
              subscription_age_group: cm.subscription_age_group,
              dentistInfoId: user.dentistInfo.id,
              active: true
            })
          );
          notifyPlanUpdate(cm.id, membership.name, membership.price, officeInfo.officeName, officeInfo);
        }
      }
    });
    // Is discount percentage changed?
    const anyActiveMembership = currentMemberships.find(cm => cm.active);
    if (parseInt(pricing.treatmentDiscount) !== anyActiveMembership.discount) {
      shouldRefresh = true;
      const membershipIdsToUpdate = currentMemberships
        .filter(cm => cm.active)
        .map(cm => cm.id);
      queries.push(
        db.Membership.update({
          discount: parseInt(pricing.treatmentDiscount)
        }, {
          where: {
            id: membershipIdsToUpdate
          }
        })
      );
    }
  }

  if (user.phone) {
    queries.push(
      db.Phone.update({
        number: user.phone,
      }, {
        where: {
          userId: dentistInfo.get('userId'),
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

  // Logic to Add / Delete Services offered by the Dentist.
  if (services) {
    const originalServices = dentistInfo.get('services').map((s) => {
      if (s.service === null) {
        return null;
      }
      return s.service.id;
    });
    const alteredServices = services;

    const servicesDiff = processDiff(originalServices, alteredServices);
    if (!servicesDiff.isSame) {
      // Add services check
      if (servicesDiff.addedItems.length) {
        servicesDiff.addedItems.forEach(serviceId => {
          queries.push(
            db.DentistInfoService.create({
              dentistInfoId: dentistInfo.get('id'),
              serviceId
            })
          );
        });
      }

      // Delete services check
      if (servicesDiff.removedItems.length) {
        servicesDiff.removedItems.forEach(serviceId => {
          queries.push(
            db.DentistInfoService.destroy({
              where: {
                dentistInfoId: dentistInfo.get('id'),
                serviceId
              }
            })
          );
        });
      }
    }
  }

  if (officeInfo.officeImages) {
    
    // update office images.
    const previousImages = dentistInfo.get('officeImages');

    // Go through the images to add.
    officeInfo.officeImages.forEach((imageUrl) => {
      const imageAlreadyExists =
          previousImages.find(s => s.url === imageUrl);
      if (!imageAlreadyExists) {
        queries.push(
          db.DentistInfoPhotos.upsert({
            url: imageUrl,
            dentistInfoId: dentistInfo.get('id')
          })
        );
      }
    });
  }

  Promise.all(queries).then(data => {
    return res.status(200).send({ shouldRefresh });
  },err => {
    console.log("Error in dentist update");
    console.log(err);
    return res.status(500).send(err);
  });
}

/**
 * Delete a dentist image.
 */
async function deleteDentistInfoPhoto(req, res) {
  try {
    const { dentistInfoId, dentistInfoPhotoId } = req.params;
    const dentistInfo = await db.DentistInfo.findOne({ where: { id: dentistInfoId } });
    if (!dentistInfo) {
      throw ForbiddenError('Invalid dentistInfoId');
    }
    if (dentistInfo.get('userId') !== req.user.get('id') && req.user.type !== 'admin') {
      throw ForbiddenError('Not the dentist owner');
    }

    const dentistInfoPhoto = await db.DentistInfoPhotos.findOne({ where: { id: dentistInfoPhotoId } });
    if (!dentistInfoPhoto) {
      throw ForbiddenError('Invalid dentistInfoPhotoId');
    }
    await deleteObjectInS3(dentistInfoPhoto.url);
    await dentistInfoPhoto.destroy();
    return res.status(200).json({ message: 'Delete OK' });
  } catch (e) {
    if (e.errors) {
      return res.status(400).send(e);
    }
    console.log('Error in deleteDentistInfoPhoto');
    console.log(e);
    return res.status(500).json({ errors: 'Internal Server Error' });
  }
}

async function deleteDentistInfoLogo(req, res) {
  try {
    const { dentistInfoId } = req.params;
    const dentistInfo = await db.DentistInfo.findOne({ where: { id: dentistInfoId } });
    if (!dentistInfo) {
      throw ForbiddenError('Invalid dentistInfoId');
    }
    if (dentistInfo.get('userId') !== req.user.get('id') && req.user.type !== 'admin') {
      throw ForbiddenError('Not the dentist owner');
    }

    await deleteObjectInS3(dentistInfo.logo);
    dentistInfo.logo = null;
    await dentistInfo.save();
    return res.status(200).json({ message: 'Delete OK' });
  } catch (e) {
    if (e.errors) {
      console.log(e);
      return res.status(400).send(e);
    }
    console.log('Error in deleteDentistInfoLogo');
    console.log(e);
    return res.status(500).json({ errors: 'Internal Server Error' });
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/:dentistId/edit/:dentistInfoId')
  .post(
    userRequired,
    injectDentistInfo('dentistId'),
    updateDentistInfo
  );

router
  .route('/')
  .get(
    userRequired,
    injectDentistInfo(),
    getDentistInfo,
    getCustomMembership
  );

router
  .route('/:dentistInfoId/photos/:dentistInfoPhotoId')
  .delete(
    userRequired,
    dentistRequired,
    deleteDentistInfoPhoto
  );

router
  .route('/:dentistInfoId/logo/')
  .delete(
    userRequired,
    dentistRequired,
    deleteDentistInfoLogo
  );

export default router;
