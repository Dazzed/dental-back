import { updateTotalMembership } from '../utils/helpers';

export default function (sequelize, DataTypes) {
  const Membership = sequelize.define('Membership', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: '',
    },
    discount: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    stripePlanId: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  }, {
    tableName: 'memberships',

    timestamps: false,

    classMethods: {
      associate(models) {
        Membership.belongsTo(models.User, { foreignKey: 'userId' });
      }
    }
  });

  return Membership;
}
