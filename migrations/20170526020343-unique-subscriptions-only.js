module.exports = {
  up: (queryInterface, Sequelize) =>
    queryInterface.changeColumn('subscriptions', 'clientId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      unique: true,
    }),
  down: (queryInterface, Sequelize) =>
    queryInterface.changeColumn('subscriptions', 'clientId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      unique: false,
    }),
};
