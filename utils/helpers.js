import changeFactory from 'change-js';

const Change = changeFactory();


export function updateTotalMembership(membership) {
  if (membership.items) {
    let total = new Change({ cents: 0 });
    membership.items.forEach(item => {
      total = total.add(new Change({ dollars: item.price }));
    });

    let withDiscount = total;

    if (membership.recommendedFee) {
      withDiscount = withDiscount.subtract(
        withDiscount.multiply(membership.discount / 100)
      );
    }

    membership.price = total.dollars();
    membership.withDiscount = withDiscount.dollars();
  }
}
