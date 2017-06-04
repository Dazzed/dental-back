module.exports = {
  up: (queryInterface, Sequelize) =>
    Promise.all([
      queryInterface.addColumn('subscriptions', 'paymentProfileId', {
        type: Sequelize.BIGINT,
        references: {
          model: 'paymentProfiles',
          key: 'id',
        }
      }),
      queryInterface.removeColumn('subscriptions', 'paidAt'),
      queryInterface.removeColumn('subscriptions', 'monthly'),
      queryInterface.removeColumn('subscriptions', 'yearly'),
      queryInterface.removeColumn('subscriptions', 'chargeID'),
      queryInterface.renameColumn('subscriptions', 'total', 'amount'),
    ]),
  down: (queryInterface, Sequelize) =>
    Promise.all([
      queryInterface.removeColumn('subscriptions', 'paymentProfileId'),
      queryInterface.addColumn('subscriptions', 'paidAt', {
        type: Sequelize.DATE
      }),
      queryInterface.addColumn('subscriptions', 'monthly', {
        type: new Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.addColumn('subscriptions', 'yearly', {
        type: new Sequelize.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
      }),
      queryInterface.addColumn('subscriptions', 'chargeID', {
        type: Sequelize.STRING
      }),
      queryInterface.renameColumn('subscriptions', 'amount', 'total'),
    ]),
};
