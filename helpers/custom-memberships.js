import _ from 'lodash';

import db from '../models';
import { processDiff } from '../utils/compareUtils';

// Converts given string to lower case and trims it.
function lcTrim(string) {
  return string.toLowerCase().trim();
}

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
      type: 'custom',
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

  if (codes.some(({ priceCodeName, price, frequency }) => !priceCodeName || !price || !frequency)) {
    return res.status(400).json({ errors: 'codes are not valid. Missing params.' });
  }
  // Check if there are any duplicate Code names.
  const originalLength = codes.length;
  const alteredLength = _.uniq(codes.map(c => lcTrim(c.priceCodeName))).length;
  if (originalLength !== alteredLength) {
    // Convey FE about which code name is duplicate.
    let duplicateCode = '';
    codes.reduce((acc, { priceCodeName }) => {
      if (acc.includes(lcTrim(priceCodeName))) {
        duplicateCode = priceCodeName;
        return acc;
      }
      acc.push(lcTrim(priceCodeName));
      return acc;
    }, []);
    return res.status(400).json({ errors: `You seem to have entered Price and Frequency for ${duplicateCode} multiple times.` });
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

  if (codes.some(({ priceCodeName, price, frequency }) => !priceCodeName || !price || !frequency)) {
    return res.status(400).json({ errors: 'codes are not valid. Missing params.' });
  }
  // Check if there are any duplicate Code names.
  const originalLength = codes.length;
  const alteredLength = _.uniq(codes.map(c => lcTrim(c.priceCodeName))).length;
  if (originalLength !== alteredLength) {
    // Convey FE about which code name is duplicate.
    let duplicateCode = '';
    codes.reduce((acc, { priceCodeName }) => {
      if (acc.includes(lcTrim(priceCodeName))) {
        duplicateCode = priceCodeName;
        return acc;
      }
      acc.push(lcTrim(priceCodeName));
      return acc;
    }, []);
    return res.status(400).json({ errors: `You seem to have entered Price and Frequency for ${duplicateCode} multiple times.` });
  }
  return next();
}

async function isValidDeleteCustomMembershipObject(req, res, next) {
  try {
    const { membershipId } = req.body;
    const membership = await db.Membership.findOne({
      where: {
        id: Number(membershipId)
      }
    });
    if (!membership) {
      throw {};
    }
    req.deletingMembership = membership;
    
    return next();
  } catch (e) {
    console.log('Error in isValidDeleteCustomMembershipObject');
    console.log(e);
    return res.status(400).send({ errors: 'Invalid Membership' });
  }
}

// When Patching, we will get records with frequency and price type as string.
// convert String type to Number
function translateEditCustomMembershipValues(req, res, next) {
  const {
    codes
  } = req.body;
  if (codes) {
    if (codes.length) {
      req.body.codes.forEach((c, i) => {
        c.frequency = parseInt(c.frequency, 10);
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
    const originalPayload = membership.custom_items.map(c => c.toJSON());
    let noChange = true;
    
    if (!originalPayload) {
      const errors = { errors: 'Invalid membership Id' };
      throw errors;
    }
    // Added
    if (alteredPayload.some(p => !p.id)) {
      noChange = false;
      return next();
    }
    // Deleted
    const originalIds = originalPayload.map(p => p.id);
    const alteredIds = alteredPayload.map(p => p.id);
    if (!processDiff(originalIds, alteredIds).isSame) {
      noChange = false;
      return next();
    }
    // Edited
    originalPayload.forEach((p, i) => {
      const { price, frequency } = p;
      if (parseFloat(price) !== parseFloat(alteredPayload[i].price) || frequency !== alteredPayload.frequency) {
        noChange = false;
        return next();
      }
    });
    if (parseFloat(membership.price) !== parseFloat(alteredPrice)) {
      noChange = false;
      return next();
    }
    
    if (noChange) {
      throw { errors: 'No change to Edit' };
    } else {
      return next();
    }
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
  isValidDeleteCustomMembershipObject,
  translateEditCustomMembershipValues,
  isSame,
  getMembership,
  getAllMemberships
};
