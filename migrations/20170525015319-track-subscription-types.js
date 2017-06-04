require('babel-register')();

const SUBSCRIPTION_TYPES = require('../config/constants').SUBSCRIPTION_TYPES;

module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.addColumn('subscriptions', 'type', {
      type: new Sequelize.ENUM(SUBSCRIPTION_TYPES),
      allowNull: false,
      defaultValue: SUBSCRIPTION_TYPES[0]
    }),
  down: (queryInterface) =>
    Promise.all([
      queryInterface.removeColumn('subscriptions', 'type'),
      queryInterface.sequelize.query('DROP TYPE "enum_subscriptions_type"'),
    ]),
};
