'use strict';
require('babel-register');

const constants = require('../config/constants');
module.exports = {
  up: function (queryInterface, Sequelize) {
    const schema = {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      membershipId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: { notEmpty: true },
        references: {
          model: 'memberships',
          key: 'id'
        }
      },
      newPlanName: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: { notEmpty: true }
      },
      newPrice: {
        type: new Sequelize.DECIMAL(6, 2),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
      },
      updatedAt: {
        type: Sequelize.DATE,
      }
    };

    return queryInterface.createTable('membershipUpdateRequests', schema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('membershipUpdateRequests');
  }
};
