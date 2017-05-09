module.exports = {
  up: (queryInterface, Sequelize) => {
    const schema = {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      description: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: new Date()
      }
    };

    return queryInterface.createTable('priceCodes', schema);
  },

  down: (queryInterface) => queryInterface.dropTable('priceCodes')
};
