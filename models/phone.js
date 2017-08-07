export default function (sequelize, DataTypes) {
  const Phone = sequelize.define('Phone', {
    number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
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
