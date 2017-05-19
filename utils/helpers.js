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

export function getPendingAmountFromRawData(inputData) {
  let total = new Change({ cents: 0 });
  const data = {
    members: [],
  };

  (inputData.members || []).forEach((member) => {
    const subscription = member.subscription;
    total = total.add(new Change({ dollars: subscription.monthly }));
    data.members.push({
      monthly: subscription.monthly,
      fullName: `${member.firstName} ${member.lastName}`
    });
  });

  // add the main member.
  if (inputData.payingMember) {
    total = total.add(new Change({ dollars: inputData.subscription.monthly }));
    data.members.push({
      monthly: inputData.subscription.monthly,
      fullName: `${inputData.firstName} ${inputData.lastName}`
    });
  }

  total = total.dollars().toFixed(2);
  data.total = total;

  return { total, data };
}
