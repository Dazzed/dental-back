export default function (sequelize, DataTypes) {
  const MarketingCategory = sequelize.define('MarketingCategory', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    }
  }, {
    tableName: 'marketingCategories',

    timestamps: true,

    classMethods: {
      associate(models) {
        MarketingCategory.hasMany(models.MarketingMaterial, {
          foreignKey: 'marketingCategoryId',
          as: 'materials',
          allowNull: true,
        });
      }
    },
  });

  return MarketingCategory;
}
