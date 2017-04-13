'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    Promise.all(
      ['cancellationFee', 'reEnrollmentFee']
      .map(field =>
        queryInterface.addColumn('users', field, {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        })
      )
    );
  },

  down: function (queryInterface, Sequelize) {
    Promise.all(
      ['cancellationFee', 'reEnrollmentFee']
      .map(field => queryInterface.removeColumn('users', field))
    );
  }
};
