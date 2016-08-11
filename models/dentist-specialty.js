export default function (sequelize, DataTypes) {
  const DentistSpecialty = sequelize.define('DentistSpecialty', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
  }, {
    tableName: 'dentistSpecialties',
    classMethods: {
      associate(models) {
        DentistSpecialty.hasMany(models.User, {
          foreignKey: 'dentistSpecialtyId',
          as: 'dentists',
          allowNull: true
        });
      }
    }
  });

  return DentistSpecialty;
}
