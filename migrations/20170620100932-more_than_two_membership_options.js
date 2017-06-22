'use strict';
require('babel-register')();

const SUBSCRIPTION_AGE_GROUPS = require('../config/constants').SUBSCRIPTION_AGE_GROUPS;

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([

      queryInterface.removeColumn('dentistInfos', 'childMembershipId'),

      queryInterface.removeColumn('dentistInfos', 'membershipId'),

      queryInterface.addColumn('memberships', 'subscription_age_group', {
        type: new Sequelize.ENUM(SUBSCRIPTION_AGE_GROUPS),
        allowNull: false,
        defaultValue: SUBSCRIPTION_AGE_GROUPS[0],
      }),

    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([

      queryInterface.addColumn('dentistInfos', 'childMembershipId', {
        type: Sequelize.INTEGER,
        onDelete: 'CASCADE',
        references: {
          model: 'memberships',
          key: 'id',
        },
      }),

      queryInterface.addColumn('dentistInfos', 'membershipId', {
        type: Sequelize.INTEGER,
        onDelete: 'CASCADE',
        references: {
          model: 'memberships',
          key: 'id',
        },
      }),

      queryInterface.removeColumn('memberships', 'subscription_age_group')
      .then(() => {
        return queryInterface.sequelize.query('DROP TYPE "enum_memberships_subscription_age_group"');
      }),

    ]);
  }
};
