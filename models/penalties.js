export default function (sequelize, DataTypes) {
  const Penalties = sequelize.define('Penalties', {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    timestamps: true,
    tableName: 'penalties'
  });

  return Penalties;
}
