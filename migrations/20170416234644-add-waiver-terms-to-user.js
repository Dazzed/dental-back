'use strict';

const fieldNames = [
  'periodontalDiseaseWaiver',
  'cancellationFeeWaiver',
  'reEnrollmentFeeWaiver',
  'termsAndConditions'
];

module.exports = {
  up: function (queryInterface, Sequelize) {
    const queries = fieldNames.map(field => {
      queryInterface.addColumn('users', field, {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      });
    });
    queries.push(
      queryInterface.addColumn('users', 'waiverCreatedAt', {
        type: Sequelize.DATE,
        allowNull: true
      })
    );
    return Promise.all(queries);
  },

  down: function (queryInterface, Sequelize) {
    const queries = fieldNames.forEach(field => {
      queryInterface.removeColumn('users', field);
    });
    queries.push(queryInterface.removeColumn('users', 'waiverCreatedAt'));
    return Promise.all(queries);
  }
};
