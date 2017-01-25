'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.bulkInsert('dentistSpecialties', [{
      name: 'General Dentist',
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Pediatric Dentist',
      createdAt: new Date(),
      updatedAt: new Date()
    }, {
      name: 'Periodontist',
      createdAt: new Date(),
      updatedAt: new Date()
    }], {});
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.bulkDelete('dentistSpecialties', null, {});
  }
};
