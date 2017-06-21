export default function (sequelize, DataTypes) {
  const MembershipUpdateRequest = sequelize.define('MembershipUpdateRequest', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    membershipId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { notEmpty: true },
      references: {
        model: 'memberships',
        key: 'id'
      }
    },
    newPlanName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true }
    },
    newPrice: {
      type: new DataTypes.DECIMAL(6, 2),
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
    },
    updatedAt: {
      type: DataTypes.DATE,
    }
  }, {
      tableName: 'membershipUpdateRequests',
      timestamps: true,
    });

  return MembershipUpdateRequest;
}

