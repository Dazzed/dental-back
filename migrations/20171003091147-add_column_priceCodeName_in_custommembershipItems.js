'use strict';
require('babel-register');

module.exports = {
  up: async function (queryInterface, Sequelize) {
    await queryInterface.removeColumn('customMembershipItems', 'priceCodeId');
    await queryInterface.addColumn('customMembershipItems', 'priceCodeName', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: ''
    });
  },

  down: async function (queryInterface, Sequelize) {
    await queryInterface.removeColumn('customMembershipItems', 'priceCodeName');
    await queryInterface.addColumn('customMembershipItems', 'priceCodeId', {
      type: Sequelize.INTEGER,
      onDelete: 'CASCADE',
      references: {
        model: 'priceCodes',
        key: 'id',
      },
    });
  }
};
