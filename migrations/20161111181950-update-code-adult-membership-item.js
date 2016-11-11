'use strict';

module.exports = {
  up: function (queryInterface) {
    return queryInterface.sequelize.query('UPDATE "membershipItems" AS m ' +
      'SET "pricingCode" = \'0150\' ' +
      'FROM "dentistInfos" AS i ' +
      'WHERE m."membershipId" = i."membershipId" AND ' +
      'm."pricingCode" = \'1120\'');
  },

  down: function (queryInterface) {
    return queryInterface.sequelize.query('UPDATE "membershipItems" as m ' +
      'SET "pricingCode" = \'1120\' ' +
      'FROM "dentistInfos" AS i ' +
      'WHERE m."membershipId" = i."membershipId" AND ' +
      'm."pricingCode" = \'0150\'');
  }
};
