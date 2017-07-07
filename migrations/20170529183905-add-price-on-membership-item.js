module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('memberships', 'price', {
      type: Sequelize.NUMERIC(6, 2),
      defaultValue: 0,
      allowNull: false,
    });
  },

  down: (queryInterface) => {
    return queryInterface.removeColumn('memberships', 'price');
  }
};
