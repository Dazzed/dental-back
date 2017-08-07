module.exports = {
  up: queryInterface =>
    Promise.all([
      queryInterface.removeColumn('users', 'accountHolder'),
      queryInterface.removeColumn('users', 'payingMember'),
      queryInterface.removeColumn('users', 'authorizeId'),
      queryInterface.removeColumn('users', 'paymentId'),
    ]),
  down: (queryInterface, Sequelize) =>
    Promise.all([
      queryInterface.addColumn('users', 'accountHolder', {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      }),
      queryInterface.addColumn('users', 'payingMember', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }),
      queryInterface.addColumn('users', 'authorizeId', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }),
      queryInterface.addColumn('users', 'paymentId', {
        type: Sequelize.INTEGER,
        allowNull: true,
      }),
    ]),
};
