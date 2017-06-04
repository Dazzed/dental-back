'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.renameColumn('membershipItems', 'pricingCode', 'pricingCodeId');
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.renameColumn('membershipItems', 'pricingCodeId', 'pricingCode');
  }
};
