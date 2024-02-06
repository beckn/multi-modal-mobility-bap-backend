const Rides = (sequelize, DataTypes) => {
  const rides = sequelize.define(
    'rides',
    {

      routeId: {
        type: DataTypes.STRING,
        allowNull: false
      },

      type: {
        type: DataTypes.ENUM,
        values: ['AUTO', 'BUS', 'MULTI'],
        defaultValue: 'AUTO',
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM,
        values: ['SEARCH', 'SELECTED', 'IN_PROGRESS', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'FAILED'],
        defaultValue: 'SEARCH',
        allowNull: false
      },
      details: {
        type: DataTypes.JSON
      }
    },
    {
      timestamps: true
    }
  )

  return rides
}

module.exports = Rides
