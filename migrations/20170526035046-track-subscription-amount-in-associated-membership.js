module.exports = {
  up: (queryInterface) =>
    queryInterface.removeColumn('subscriptions', 'amount'),
  down: (queryInterface, Sequelize) =>
    queryInterface.addColumn('subscriptions', 'amount', {
      type: new Sequelize.NUMERIC(6, 2),
      defaultValue: 0.00,
      allowNull: false,
    }),
};
