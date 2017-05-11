module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'dentistInfos',
      'affordabilityScore',
      {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      }
    );
  },

  down: queryInterface => queryInterface.removeColumn('dentistInfos', 'affordabilityScore'),
};
