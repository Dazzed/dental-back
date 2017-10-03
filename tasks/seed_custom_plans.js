require('babel-register');
const db = require('../models');
const memberships = require('./defaultCustomMemberships');

// This job can only be executed from a controller method.
// Seed existing dentist's with 4 default custom membership plans below...
async function perform() {
  try {
    const dentistInfos = await db.DentistInfo.findAll({
      include: [{
        model: db.MembershipItem,
        as: 'pricing',
        include: [{
          model: db.PriceCodes,
          as: 'priceCode'
        }]
      }, {
        model: db.Membership,
        as: 'memberships'
      }]
    }).map(d => d.toJSON());

    for (const dentistInfo of dentistInfos) {
      const discount = Number(dentistInfo.memberships[0].discount);
      for (const cm of memberships) {
        const totalPrice = cm.codes.reduce((acc, c) => {
          const freq = c.frequency;
          const codePrice = dentistInfo.pricing.find(p => {
            if (p.priceCode.code === c.priceCodeName.replace('D', '')) {
              return p;
            }
          }).price;
          const discountedPrice = (parseFloat(codePrice) * freq) - ((parseFloat(codePrice) * freq) * (discount / 100));
          acc += discountedPrice / 12;
          return Math.floor(acc);
        }, 0);
        const membership = await db.Membership.create({
          name: cm.name,
          userId: dentistInfo.userId,
          discount: 0,
          price: totalPrice,
          type: 'custom',
          subscription_age_group: 'adult',
          dentistInfoId: dentistInfo.id,
          active: true,
        });

        for (const code of cm.codes) {
          const codePrice = dentistInfo.pricing.find(p => {
            if (p.priceCode.code === code.priceCodeName.replace('D', '')) {
              return p;
            }
          }).price;
          await db.CustomMembershipItem.create({
            dentistInfoId: dentistInfo.id,
            priceCodeName: code.priceCodeName,
            price: parseFloat(codePrice),
            frequency: code.frequency,
            membershipId: membership.id
          });
        }
      }
    }
    return 'Success seed_custom_plans!';
  } catch (e) {
    console.log(e);
    throw e;
  }
}

export default perform;
// perform().then(d => console.log(d), e => console.log(e));
