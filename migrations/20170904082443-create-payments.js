'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    const schema = {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      clientId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: { notEmpty: true },
      },
      dentistId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: { notEmpty: true },
      },
      stripeSubscriptionId: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: { notEmpty: true },
      },
      amount: {
        type: Sequelize.FLOAT,
        allowNull: false,
        validate: { notEmpty: true },
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    };

    return queryInterface.createTable('payments', schema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('payments');
  }
};
