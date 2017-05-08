import db from '../models';

import {
  CODES_FOR_CALC_FULL_COST,
} from '../config/constants';

/**
 * Methods related to providing additional information about Memberships
 */
export const MembershipMethods = {
  /**
   * Calculates the full cost of the membership
   *
   * @param {Number} dentistId - the id of the dentist who provides this membership
   * @param {Membership} membership - the membership to calculate against
   * @return {Array<>}
   */
  calculateCosts(dentistInfoId, memberships) {
    return Promise.all(memberships.map(membershipId =>
      new Promise((resolve, reject) => {
        db.PriceCodes.findAll({
          include: [{
            model: db.MembershipItem,
            as: 'membershipItems',
            where: {
              dentistInfoId,
              membershipId,
            },
          }]
        }).then(priceCodes => {
          priceCodes = priceCodes.reduce((obj, pc) => {
            obj[pc.code] = pc.membershipItems.shift().price || 0;
            return obj;
          }, {});

          // Calculate the full cost
          const fullCost =
            (priceCodes['1110'] * 2) +
            (priceCodes['0120'] * 2) +
            priceCodes['0274'] +
            (priceCodes['0330'] * 0.3) +
            priceCodes['0220'] +
            priceCodes['0140'] || 0;

          resolve({ membershipId, fullCost });
        }).catch(err => reject(err));
      }))
    );
  }
};
