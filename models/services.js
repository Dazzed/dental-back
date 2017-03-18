export default function (sequelize, DataTypes) {
  const Service = sequelize.define('Service', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
  }, {
    tableName: 'services',
    classMethods: {
      associate(models) {
        // Service.belongsTo(models.DentistInfo, {
        //   foreignKey: 'dentistInfoId',
        //   as: 'dentistInfo',
        // });
      }
    }
  });

  return Service;
}
