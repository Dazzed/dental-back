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

export {
  transformFieldsToFixed
};
