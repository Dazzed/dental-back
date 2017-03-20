'use strict';
module.exports = function(sequelize, DataTypes) {
  const DentistService = sequelize.define('DentistInfoService', {
    // serviceId: {
    //   type: DataTypes.NUMBER,
    //   allowNull: false
    // },
    // dentistInfoId: {
    //   type: DataTypes.NUMBER,
    //   allowNull: false
    // }
  }, {
    tableName: 'dentistInfoService',
    classMethods: {
      associate(models) {
        DentistService.belongsTo(models.DentistInfo, {
          foreignKey: 'dentistInfoId',
          as: 'dentistInfo'
        });
        DentistService.belongsTo(models.Service, {
          foreignKey: 'serviceId',
          as: 'service'
        });
      }
    }
  });
  return DentistService;
};
