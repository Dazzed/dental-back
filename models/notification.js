export default function (sequelize, DataTypes) {
  const Notification = sequelize.define('Notification', {
    title: {
      type: DataTypes.STRING,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    }
  }, {
    tableName: 'notifications',
    classMethods: {
      associate(models) {
        Notification.belongsTo(models.User, {
          foreignKey: 'recipientId',
          as: 'recipient',
        });
      }
    }
  });

  return Notification;
}
