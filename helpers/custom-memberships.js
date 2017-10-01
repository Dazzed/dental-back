import _ from 'lodash';

import db from '../models';
import { processDiff } from '../utils/compareUtils';

function getMembership(id) {
  return db.Membership.findOne({
    where: {
      id
    },
    include: [{
      model: db.CustomMembershipItem,
      as: 'custom_items',
    }]
  });
}

// Get all the custom memberships of a dentist.
function getAllMemberships(dentistId, includeItems = false) {
  const include = includeItems ? [{
    model: db.CustomMembershipItem,
    as: 'custom_items'
  }] : [];

  return db.Membership.findAll({
    where: {
      userId: dentistId,
      type: 'custom'
    },
    include
  });
}

function isValidCustomMembershipObject(req, res, next) {
  const {
    planName,
    fee,
    codes
  } = req.body;

  if (!planName || !fee || !codes) {
    return res.status(400).json({ errors: 'Missing planName or fee or codes.' });
  }

  if (!codes.length) {
    return res.status(400).json({ errors: 'codes must not be empty.' });
  }

  if (codes.some(({ priceCodeId, price, frequency }) => !priceCodeId || !price || !frequency)) {
    return res.status(400).json({ errors: 'codes are not valid. Missing params.' });
  }
  const originalLength = codes.length;
  const alteredLength = _.uniq(codes.map(c => c.priceCodeId)).length;
  if (originalLength !== alteredLength) {
    return res.status(400).json({ errors: 'You seem to have selected Price and Frequency for The same code multiple times.' });
  }
  return next();
}

function isValidEditCustomMembershipObject(req, res, next) {
  const {
    codes,
    membershipId
  } = req.body;

  if (!membershipId) {
    return res.status(400).json({ errors: 'Membership id is required.' });
  }

  if (!codes) {
    return res.status(400).json({ errors: 'Missing codes.' });
  }

  if (!codes.length) {
    return res.status(400).json({ errors: 'codes must not be empty.' });
  }

  if (codes.some(({ priceCodeId, price, frequency }) => !priceCodeId || !price || !frequency)) {
    return res.status(400).json({ errors: 'codes are not valid. Missing params.' });
  }
  const originalLength = codes.length;
  const alteredLength = _.uniq(codes.map(c => c.priceCodeId)).length;
  if (originalLength !== alteredLength) {
    return res.status(400).json({ errors: 'You seem to have selected Price and Frequency for The same code multiple times.' });
  }
  return next();
}

// When Patching, we will get records with priceCodeId and frequency and price type as string.
// convert String type to Number
function translateEditCustomMembershipValues(req, res, next) {
  const {
    codes
  } = req.body;
  if (codes) {
    if (codes.length) {
      req.body.codes.forEach((c, i) => {
        c.priceCodeId = Number(c.priceCodeId);
        c.frequency = Number(c.frequency);
        c.price = parseFloat(c.price);
        if (c.price_code) {
          delete c.price_code;
        }
      });
    }
  }
  next();
}

// Function that compares the edit objects.
// Do not update membership if nothing is edited.
async function isSame(req, res, next) {
  try {
    const { membershipId, price: alteredPrice, codes: alteredPayload } = req.body;
    
    const membership = await getMembership(membershipId);
    req.oldMembership = membership;
    const originalPayload = membership.custom_items;
    
    if (!originalPayload) {
      const errors = { errors: 'Invalid membership Id' };
      throw errors;
    }
    // Added
    if (alteredPayload.some(p => !p.id)) {
      return next();
    }
    // Deleted
    const originalIds = originalPayload.map(p => p.id);
    const alteredIds = alteredPayload.map(p => p.id);
    if (!processDiff(originalIds, alteredIds).isSame) {
      return next();
    }
    // Edited
    originalPayload.forEach((p, i) => {
      const { price, frequency } = p;
      if (price !== alteredPayload[i].price || frequency !== alteredPayload.frequency) {
        return next();
      }
    });
    if (parseFloat(membership.price) !== parseFloat(alteredPrice)) {
      return next();
    }

    return res.status(400).json({ errors: 'No change to Edit' });
  } catch (e) {
    console.log('Error in isSame middleware');
    console.log(e);
    if (e.errors) {
      return res.status(400).json({ errors: e.errors });
    }
    return res.status(500).json({ errors: 'Internal Server Error' });
  }
}

export {
  isValidCustomMembershipObject,
  isValidEditCustomMembershipObject,
  translateEditCustomMembershipValues,
  isSame,
  getMembership,
  getAllMemberships
};
