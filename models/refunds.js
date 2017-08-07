export default function (sequelize, DataTypes) {
  const Refunds = sequelize.define('Refunds', {
    transId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    authorizeId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      allowNull: false,
    },
  }, {
    tableName: 'refunds',
    timestamps: true,
  });

  return Refunds;
}
