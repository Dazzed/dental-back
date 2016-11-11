'use strict';

module.exports = {
  up: function (queryInterface) {
    return Promise.all([
      queryInterface.sequelize.query('UPDATE "membershipItems" AS m ' +
        'SET "pricingCode" = \'0150\' ' +
        'FROM "dentistInfos" AS i ' +
        'WHERE m."membershipId" = i."childMembershipId" AND ' +
        'm."pricingCode" = \'1110\''),
      queryInterface.sequelize.query('UPDATE "membershipItems" AS m ' +
        'SET "pricingCode" = \'1206\' ' +
        'FROM "dentistInfos" AS i ' +
        'WHERE m."membershipId" = i."childMembershipId" AND ' +
        'm."pricingCode" = \'1208\''),
    ]);
  },

  down: function (queryInterface) {
    return Promise.all([
      queryInterface.sequelize.query('UPDATE "membershipItems" AS m ' +
        'SET "pricingCode" = \'1110\' ' +
        'FROM "dentistInfos" AS i ' +
        'WHERE m."membershipId" = i."childMembershipId" AND ' +
        'm."pricingCode" = \'0150\''),
      queryInterface.sequelize.query('UPDATE "membershipItems" AS m ' +
        'SET "pricingCode" = \'1208\' ' +
        'FROM "dentistInfos" AS i ' +
        'WHERE m."membershipId" = i."childMembershipId" AND ' +
        'm."pricingCode" = \'1206\''),
    ]);
  }
};
