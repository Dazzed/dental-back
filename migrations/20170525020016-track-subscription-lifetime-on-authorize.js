module.exports = {
  up: (queryInterface, Sequelize) =>
    Promise.all([
      queryInterface.addColumn('subscriptions', 'authorizeSubscriptionId', {
        type: Sequelize.INTEGER,
      }),
      queryInterface.removeColumn('subscriptions', 'createdAt'),
      queryInterface.removeColumn('subscriptions', 'updatedAt'),
    ]),
  down: (queryInterface, Sequelize) =>
    Promise.all([
      queryInterface.removeColumn('subscriptions', 'authorizeSubscriptionId'),
      queryInterface.addColumn('subscriptions', 'createdAt', {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      }),
      queryInterface.addColumn('subscriptions', 'updatedAt', {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      }),
    ]),
};
