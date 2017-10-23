function transformFieldsToFixed(parentMemberRecords) {
  return parentMemberRecords.map((pmr) => {
    let {
      fee,
      penalties,
      refunds,
      net,
      family
    } = pmr;

    fee = fee.toFixed(2);
    penalties = penalties.toFixed(2);
    refunds = refunds.toFixed(2);
    net = net.toFixed(2);

    family = family.map((f) => {
      const {
        fee: ffee,
        penalties: fpenalities,
        refunds: frefunds,
        net: fnet
      } = f;

      fee = ffee.toFixed(2);
      penalties = fpenalities.toFixed(2);
      refunds = frefunds.toFixed(2);
      net = fnet.toFixed(2);
      return {
        ...f,
        fee,
        penalties,
        refunds,
        net
      };
    });

    return {
      ...pmr,
      fee,
      penalties,
      refunds,
      net,
      family
    };
  });
}

export {
  transformFieldsToFixed
};
