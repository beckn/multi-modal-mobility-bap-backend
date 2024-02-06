const User = (sequelize, DataTypes) => {
  const user = sequelize.define(
    'user',
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
      email: {
        type: DataTypes.STRING,
        unique: false,
        allowNull: true,
        validate: {
          isEmail: true
        }
      },
      isUserVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      gender: {
        type: DataTypes.ENUM,
        values: ['Male', 'Female', 'Other'],
        defaultValue: 'Male',
        allowNull: false
      },
      mobileNo: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
          len: [10, 12]
        }
      },
      profile_url: {
        type: DataTypes.STRING,
        allowNull: true
      }
    },
    {
      timestamps: true
    }
  )

  /**
   * Check if email is taken
   * @param {string} email - The user's email
   * @returns {Promise<boolean>}
   */
  user.isMobileNoRegistered = async function (mobileNo) {
    const userFound = await this.findOne({
      where: {
        mobileNo
      }
    })
    return !!userFound
  }

  return user
}

module.exports = User
