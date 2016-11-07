export default function (sequelize, DataTypes) {
  const Message = sequelize.define('Message', {
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    }
  }, {
    tableName: 'messages',
    classMethods: {
      associate(models) {
        Message.belongsTo(models.Conversation, {
          foreignKey: 'conversationId',
          as: 'conversation',
        });

        Message.belongsTo(models.User, {
          foreignKey: 'userId',
          as: 'author',
        });
      }
    }
  });

  return Message;
}
