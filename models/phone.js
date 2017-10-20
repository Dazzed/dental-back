export default function (sequelize, DataTypes) {
  const Phone = sequelize.define('Phone', {
    number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: false,
    },
  }, {
    tableName: 'phones',
    classMethods: {
      associate() {
      }
    }
  });

  return Phone;
}
