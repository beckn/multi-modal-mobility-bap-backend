const Job = (sequelize, DataTypes) => {
  const job = sequelize.define(
    'jobs',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING,
        unique: false,
        allowNull: true
      },
      input: {
        type: DataTypes.JSON
      },

      status: {
        type: DataTypes.ENUM,
        values: ['IN PROGRESS', 'COMPLETED', 'FAILED'],
        defaultValue: 'IN PROGRESS',
        allowNull: false
      },
      response: {
        type: DataTypes.JSON
      }
    },
    {
      timestamps: true
    }
  )

  return job
}

module.exports = Job
