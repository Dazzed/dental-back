/* eslint max-len:0 */
// ────────────────────────────────────────────────────────────────────────────────
// MODULES

import { Router } from 'express';

import db from '../../models';

// ────────────────────────────────────────────────────────────────────────────────
// ROUTER

/**
 * Gets a list of dentist offices
 *
 * @param {Object} req - the express request
 * @param {Object} res - the express response
 */
function getOffices(req, res, next) {
  let offices = [];
  let result = [];

  db.DentistInfo.findAll({
    attributes: {
      exclude: ['createdAt', 'updatedAt', 'userId', 'membershipId', 'childMembershipId'],
    },
    include: [{
      model: db.Membership,
      as: 'membership',
      attributes: {
        exclude: ['price', 'userId'],
      },
    }, {
      model: db.Membership,
      as: 'childMembership',
      attributes: {
        exclude: ['price', 'userId'],
      },
    }, {
      model: db.WorkingHours,
      as: 'workingHours',
      attributes: {
        exclude: ['createdAt', 'updatedAt', 'dentistInfoId'],
      },
    }, {
      model: db.MembershipItem,
      as: 'pricing',
      attributes: {
        exclude: ['dentistInfoId', 'pricingCodeId'],
      },
      include: [{
        model: db.PriceCodes,
        as: 'priceCode',
        attributes: {
          exclude: ['dentistInfoId'],
        },
      }]
    }, {
      model: db.DentistInfoPhotos,
      as: 'officeImages',
      attributes: ['url'],
    }, {
      model: db.DentistInfoService,
      as: 'services',
      include: [{
        model: db.Service,
        as: 'service'
      }],
    }],
  })
  .then((officesRes) => {
    offices = officesRes;
    result = officesRes.map(o => o.toJSON());

    return Promise.all(officesRes.map(o => o.membership.getPlanCosts()));
  })
  .then((memPlanCosts) => {
    memPlanCosts.forEach((p, i) => {
      result[i].membership = Object.assign({}, result[i].membership, memPlanCosts[i]);
    });
    return Promise.all(offices.map(o => o.childMembership.getPlanCosts()));
  })
  .then((memChildPlanCosts) => {
    memChildPlanCosts.forEach((p, i) => {
      result[i].childMembership = Object.assign({}, result[i].childMembership, memChildPlanCosts[i]);
    });

    // Fix pricing codes
    result.forEach((m, i) => {
      result[i].pricing.forEach((p, j) => {
        result[i].pricing[j].code = p.priceCode.code;
        result[i].pricing[j].description = p.priceCode.description;
        delete result[i].pricing[j].priceCode;
      });
      // Fix Office Images
      result[i].officeImages = result[i].officeImages.map(o => o.url);
      // Fix services
      result[i].services = result[i].services.map(s => (s.service ? s.service.name || null : null));
    });

    // Omit properties
    result.forEach((m, i) => { delete result[i].membership.stripePlanId; });
    result.forEach((m, i) => { delete result[i].childMembership.stripePlanId; });

    res.json({ data: Object.values(Object.assign({}, offices, result)) });
  })
  .catch(next);
}

// ────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS

const router = new Router({ mergeParams: true });

router
  .route('/')
  .get(getOffices);

export default router;
