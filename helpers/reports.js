import { stripeApi } from '../controllers/stripe';

function transformFieldsToFixed(parentMemberRecords) {
  return parentMemberRecords.map((pmr) => {
    let {
      fee: parentFee,
      penalties: parentPenalities,
      refunds: parentRefunds,
      net: parentNet,
      family
    } = pmr;

    parentFee = parentFee.toFixed(2);
    parentPenalities = parentPenalities.toFixed(2);
    parentRefunds = parentRefunds.toFixed(2);
    parentNet = parentNet.toFixed(2);

    family = family.map((f) => {
      let {
        fee: ffee,
        penalties: fpenalities,
        refunds: frefunds,
        net: fnet
      } = f;

      ffee = ffee.toFixed(2);
      fpenalities = fpenalities.toFixed(2);
      frefunds = frefunds.toFixed(2);
      fnet = fnet.toFixed(2);
      return {
        ...f,
        fee: ffee,
        penalties: fpenalities,
        refunds: frefunds,
        net: fnet
      };
    });

    return {
      ...pmr,
      fee: parentFee,
      penalties: parentPenalities,
      refunds: parentRefunds,
      net: parentNet,
      family
    };
  });
}

/**
 * Description: Get the charges occured between two timestamps recursively
 * @param {[]} charges (always pass Empty array from caller. This argument is used internally by the function!)
 * @param {null} after (always pass null for after. This argument is used internally by the function!)
 * @param {object} created ({gte: number, lte: number})
 *   The range between which the charges should be retrived.
 */
async function recursiveCharges(charges = [], after = null, created) {
  if (!after && !charges.length) {
    const result = await stripeApi.charges.list({ limit: 100, created });
    charges.push(...result.data);
    if (result.data.length && result.data[99]) {
      return recursiveCharges(charges, result.data[99].id);
    }
    return charges;
  } else if (after) {
    const result = await stripeApi.charges.list({ limit: 100, starting_after: after, created });
    charges.push(...result.data);
    if (result.data.length && result.data[99]) {
      return recursiveCharges(charges, result.data[99].id);
    }
    return charges;
  }
  return charges;
}

async function recursiveInvoices(invoices = [], after = null, created) {
  if (!after && !invoices.length) {
    const result = await stripeApi.invoices.list({ limit: 100, date: created });
    invoices.push(...result.data);
    if (result.data.length && result.data[99]) {
      return recursiveInvoices(invoices, result.data[99].id);
    } else {
      return invoices;
    }
  } else if (after) {
    const result = await stripeApi.invoices.list({ limit: 100, starting_after: after, date: created });
    invoices.push(...result.data);
    if (result.data.length && result.data[99]) {
      return recursiveInvoices(invoices, result.data[99].id);
    } else {
      return invoices;
    }
  } else {
    return invoices;
  }
}

export {
  transformFieldsToFixed,
  recursiveCharges,
  recursiveInvoices,
};
