import changeFactory from 'change-js';

const Change = changeFactory();


export function updateTotalMembership(membership) {
  if (membership.codes) {
    let total = new Change({ cents: 0 });
    membership.codes.forEach(item => {
      total = total.add(new Change({ dollars: item.amount }));
    });

    let withDiscount = total;

    if (membership.recommendedFee) {
      withDiscount = withDiscount.subtract(
        withDiscount.multiplyPercent(membership.discount)
      );
    }

    membership.price = total.dollars();
    membership.withDiscount = withDiscount.dollars();
    membership.monthly = new Change({ cents: withDiscount.cents / 12 });
    membership.monthly = membership.monthly.dollars();
  }
}

export function generateRandomEmail() {
  const randomEmail = `${(Math.random() * 100).toFixed(0)}${new Date().getTime()}`;
  return `auto-${randomEmail}@dentalhq.com`;
}
