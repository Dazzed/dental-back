import moment from 'moment';
import stripe from './stripe';
import db from '../models';

export default {
  async getUserFinances(primaryAccountHolder, year) {
    const paymentProfile = await db.PaymentProfile.findOne({
      where: { primaryAccountHolder }
    });

    if (!paymentProfile) {
      throw new Error(`no paymentProfile found for account holder ${primaryAccountHolder}`);
    }

    const stripeCustomerId = paymentProfile.stripeCustomerId;

    const [invoices, charges] = await Promise.all([
      stripe.getInvoices(stripeCustomerId, year),
      stripe.getCharges(stripeCustomerId, year)
    ]);

    return {
      primaryAccountHolder,
      year,
      charges: charges.data,
      invoices: invoices.data
    };
  }
}