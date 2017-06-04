module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.changeColumn('subscriptions', 'endAt', {
      type: Sequelize.DATE,
      allowNull: true,
    }),
  down: (queryInterface, Sequelize) =>
    queryInterface.changeColumn('subscriptions', 'endAt', {
      type: Sequelize.DATE,
      allowNull: false,
    }),
};
