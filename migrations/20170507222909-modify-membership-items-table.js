module.exports = {
  up: (queryInterface, Sequelize) => {
  /*
    return queryInterface.sequelize.query(
      `
      ALTER TABLE "membershipItems"
        ALTER COLUMN "pricingCode" TYPE INT USING "pricingCode"::INT,
        ALTER COLUMN "pricingCode" SET NOT NULL,
        ADD CONSTRAINT "fk__membershipItems_pricingCode"
          FOREIGN KEY ("pricingCode") REFERENCES "priceCodes" (id);
      `
    ); */
    return Promise.resolve()
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
    ));
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.query(
      `
      ALTER TABLE "membershipItems"
        DROP CONSTRAINT "fk__membershipItems_pricingCode",
        ALTER COLUMN "pricingCode" DROP NOT NULL;
        ALTER COLUMN "pricingCode" TYPE VARCHAR(150) USING "pricingCode":VARCHAR(150),
      `
    );
  }
};
