export default function (sequelize, DataTypes) {
  const PriceCodes = sequelize.define('PriceCodes', {
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    timestamps: false,
    tableName: 'priceCodes'
  });

  return PriceCodes;
}
