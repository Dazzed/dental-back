export default function (sequelize, DataTypes) {
  const MarketingMaterial = sequelize.define('MarketingMaterial', {
    marketingCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    }
  }, {
    tableName: 'marketingMaterials',

    timestamps: true,

    classMethods: {
      associate(models) {
        MarketingMaterial.belongsTo(models.MarketingMaterial, {
          foreignKey: 'marketingCategoryId',
          as: 'category',
          allowNull: false,
        });
      }
    },
  });

  return MarketingMaterial;
}
