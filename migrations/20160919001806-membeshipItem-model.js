'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('membershipItems', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      pricingCode: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      price: {
        type: new Sequelize.DECIMAL(6, 2),
        allowNull: false,
      },
      membershipId: {
        type: Sequelize.INTEGER,
        onDelete: 'CASCADE',
        references: {
          model: 'memberships',
          key: 'id',
        },
      },
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('membershipItems');
  }
};
