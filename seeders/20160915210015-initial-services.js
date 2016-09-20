'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.bulkInsert('services', [{
      name: 'White fillings',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Extractions',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: '6 month smiles',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Silver fillings',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Wisdom teeth',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Periodontal treatment',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Porcelain crowns',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Dental implants placement',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Scaling and root planning',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Same day crowns',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Dental implant restorations',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Family Dentistry',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Cosmetic dentistry',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Dentures',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Kids under 4 years old',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Veneers',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Partial dentures',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Kids starting at 4 years old',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Porcelain onlays/inlays',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Orthodontics',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Kids starting at 7 years old',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Oral Surgery',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Invisalign',
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Root canals',
      createdAt: new Date(),
      updatedAt: new Date(),
    }], {});
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.bulkDelete('services', null, {});
  }
};
