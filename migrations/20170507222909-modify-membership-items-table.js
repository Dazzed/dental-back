module.exports = {
  up: (queryInterface, Sequelize) => {
    Promise.resolve()
    .then(() => (
      queryInterface.sequelize.query('ALTER TABLE "membershipItems" ALTER COLUMN "pricingCode" SET DATA TYPE integer USING "pricingCode"::integer;')
    ))
    .then(() => (
      queryInterface.changeColumn(
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
      )
    ))
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
