export default function (sequelize, DataTypes) {
  const DentistInfoPhotos = sequelize.define('DentistInfoPhotos', {
    url: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'dentistInfoPhotos',
    classMethods: {
      associate(models) {
        DentistInfoPhotos.belongsTo(models.DentistInfo, {
          foreignKey: 'dentistInfoId',
          as: 'dentistInfo'
        });
      }
    }
  });

  return DentistInfoPhotos;
}
