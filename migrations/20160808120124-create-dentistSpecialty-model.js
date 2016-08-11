'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    const schema = {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    };

    return queryInterface.createTable('dentistSpecialties', schema);
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('dentistSpecialties');
  }
};
