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

    const charges = await stripe.getCharges(stripeCustomerId, year);

    return {
      primaryAccountHolder,
      year,
      charges: charges.data,
    };
  },

  async getDentistFinances(dentistId, year, month) {
    const subscriptions = await db.Subscription.findAll({
      where: { dentistId },
      include: [{
        model: db.PaymentProfile,
        as: 'paymentProfile',
        attributes: ['primaryAccountHolder', 'stripeCustomerId'],
      },
      {
        model: db.User,
        as: 'client',
        attributes: ['id', 'firstName', 'middleName', 'lastName'],
      }]
    });

    const queries = subscriptions.map(async (sub) => {
      const clientFinances = await this.getUserFinances(sub.paymentProfile.primaryAccountHolder, year);
      const monthCharges = clientFinances.charges.filter((charge) => {
        const date = moment.unix(charge.created);
        return date.format('Y') === year.toString() && date.format('M') === month.toString();
      });

      // TODO check how this works with refunds, etc.
      const summarizedCharges = monthCharges.reduce((acc, cur) => {
        if (acc.currency !== cur.currency) throw new Error("currency mismatches aren't supported");
        
        return { amount: acc.amount + cur.amount, currency: "usd"};
      }, { amount: 0, currency: "usd" });

      return { client: sub.client, totalCharged: summarizedCharges, monthlyCharges: monthCharges }
    });
    const invoiceLists = await Promise.all(queries)

    return invoiceLists
  }
}