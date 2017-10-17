'use strict';

const fieldNames = [
  'cancellationFee',
  'cancellationFeeWaiver',
];

module.exports = {
  up: function (queryInterface, Sequelize) {
    const queries = fieldNames.map(field => {
      queryInterface.removeColumn('users', field);
    });
    return Promise.all(queries);
  },

  down: function (queryInterface, Sequelize) {
    const queries = fieldNames.map(field => {
      queryInterface.addColumn('users', field, {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      });
    });
    return Promise.all(queries);
  }
};
