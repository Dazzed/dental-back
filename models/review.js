export default function (sequelize, DataTypes) {
  const Review = sequelize.define('Review', {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isAnonymous: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    rating: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
  }, {
    tableName: 'reviews',
    classMethods: {
      associate(models) {
        Review.belongsTo(models.User, {
          foreignKey: 'clientId',
          as: 'client',
        });

        Review.belongsTo(models.User, {
          foreignKey: 'dentistId',
          as: 'dentist',
        });
      }
    }
  });

  return Review;
}

