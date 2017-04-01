'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.addColumn('dentistInfos', 'acceptsChildren', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      }),
      queryInterface.addColumn('dentistInfos', 'childStartingAge', {
        type: Sequelize.INTEGER,
        allowNull: true
      })
    ]);
  },

  down: function (queryInterface, Sequelize) {
    return Promise.all([
      queryInterface.removeColumn('dentistInfos', 'acceptsChildren'),
      queryInterface.removeColumn('dentistInfos', 'childStartingAge')
    ]);
  }
};
