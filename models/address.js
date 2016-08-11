export default function (sequelize, DataTypes) {
  const Address = sequelize.define('Address', {
    value: {
      type: DataTypes.STRING,
      allowNull: false
    },
  }, {
    tableName: 'addresses',
    classMethods: {
      associate() {
      }
    }
  });

  return Address;
}

