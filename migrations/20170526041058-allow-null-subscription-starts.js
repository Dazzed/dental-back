module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.changeColumn('subscriptions', 'startAt', {
      type: Sequelize.DATE,
      allowNull: true,
    }),
  down: (queryInterface, Sequelize) =>
    queryInterface.changeColumn('subscriptions', 'startAt', {
      type: Sequelize.DATE,
      allowNull: false,
    }),
};
