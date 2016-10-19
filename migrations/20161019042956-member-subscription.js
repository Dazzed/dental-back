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
      monthly: {
        type: new Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      },
      memberId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'familyMembers',
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
      subscriptionId: {
        type: Sequelize.INTEGER,
        references: {
          model: 'subscriptions',
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

    return queryInterface.createTable('memberSubscriptions', schema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('memberSubscriptions');
  }
};
