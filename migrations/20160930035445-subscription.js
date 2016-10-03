'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    const schema = {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      total: {
        type: new Sequelize.DECIMAL(6, 2),
        allowNull: false,
      },
      startAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      endAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      clientId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      dentistId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      membershipId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'memberships',
          key: 'id',
        },
      },
      createdAt: {
        type: Sequelize.DATE,
      },
      updatedAt: {
        type: Sequelize.DATE,
      },
    };

    return queryInterface.createTable('subscriptions', schema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('subscriptions');
  }
};
