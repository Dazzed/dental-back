module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'membershipItems',
      'pricingCode',
      {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'priceCodes',
          key: 'id'
        }
      }
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn(
      'membershipItems',
      'pricingCode',
      {
        type: Sequelize.STRING,
        allowNull: false
      }
    );
  }
};
