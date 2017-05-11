export default function (sequelize, DataTypes) {
  const Webhooks = sequelize.define('Webhooks', {
    webbhookId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    notificationId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    eventType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  }, {
    tableName: 'webhooks'
  });

  return Webhooks;
}

