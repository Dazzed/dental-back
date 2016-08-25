export default function (sequelize, DataTypes) {
  const Membership = sequelize.define('Membership', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    price: {
      type: new DataTypes.DECIMAL(6, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    }
  }, {
    tableName: 'memberships',
    classMethods: {
      associate(models) {
        Membership.belongsTo(models.User, { foreignKey: 'userId' });
      }
    }
  });

  return Membership;
}

