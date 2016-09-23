export default function (sequelize, DataTypes) {
  const Service = sequelize.define('Service', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
  }, {
    tableName: 'services',
    classMethods: {}
  });

  return Service;
}
