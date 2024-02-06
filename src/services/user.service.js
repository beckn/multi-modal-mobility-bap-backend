const httpStatus = require('http-status')
const multer = require('multer')
const path = require('path')
const axios = require('axios')
const { models } = require('../models')
const config = require('../config/config')
const ApiError = require('../utils/ApiError')
const { logger } = require('../config/logger')
const tokenService = require('./token.service')

const { User } = models
/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */

const createUser = async (userBody) => {
  try {
    const user = await User.create(userBody)
    return user
  } catch (err) {
    logger.error('error is :' + err)
    return null
  }
}

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async (filter, options) => {
  let users
  if (Object.keys(filter).length === 0) {
    users = await User.findAll({
      filter,
      options
    })
  } else {
    users = await User.findAll({
      filter,
      options,
      where: { filter }
    })
  }
  return users
}

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
  return User.findByPk(id)
}

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */

const getUserByMobileNo = async (mobileNo) => {
  return User.findOne({ where: { mobileNo } })
}

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */

/**
 * Update user
 * @param {Object} user
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUser = async (user, updateBody) => {
  let otpSent = false

  if (updateBody.mobileNo && updateBody.mobileNo !== user.mobileNo) {
    const getDetails = await getUserByMobileNo(updateBody.mobileNo)

    if (getDetails) { throw new ApiError(httpStatus.BAD_REQUEST, 'Mobile Number provided is already registered.') }

    await sendOTPToMobile(user, updateBody.mobileNo)
    updateBody.mobileNo = user.mobileNo
    otpSent = true
  }
  try {
    Object.assign(user, updateBody)
    await user.save()
  } catch (err) {
    logger.error(err)
  }

  return { user, otpSent }
}

const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId)
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found')
  }
  try {
    Object.assign(user, updateBody)
    await user.save()
  } catch (err) {
    logger.error(err)
  }

  return user
}

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId) => {
  const user = await getUserById(userId)
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found')
  }
  await User.destroy(userId)
  return user
}

const fileUpload = async (req, res) => new Promise(async (resolve, reject) => {
  const { user } = req
  const { id } = user
  let newFileName = ''
  const storage = multer.diskStorage({
    destination: 'public/profile_images',
    filename: (req, file, cb) => {
      newFileName = `${id}-${Date.now()}${path.extname(file.originalname)}`
      cb(null, newFileName)
    }
  })

  // picture i.e. 2 MB. it is optional
  const maxSize = 2 * 1000 * 1000

  const upload = multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (req, file, cb) => {
      // Set the filetypes, it is optionals
      const filetypes = /jpeg|jpg|png|PNG/
      logger.info(`file is : ${file}`)
      const mimetype = filetypes.test(file.mimetype)

      const extname = filetypes.test(path.extname(file.originalname).toLowerCase())

      if (mimetype && extname) {
        return cb(null, true)
      }

      cb(`Failed uploading image ${filetypes}`)
    }

    // mypic is the name of file attribute
  }).single('profile')

  await upload(req, res, async (err) => {
    if (err) {
      // ERROR occured (here it can be occured due
      // to uploading image of size greater than
      // 1MB or uploading different file type)
      logger.error(`Failed upload : ${err}`)
      return resolve({
        status: httpStatus.BAD_REQUEST,
        message: err
      })
    }

    if (req.file) {
      const response = await saveImageToModels(user, newFileName)

      return resolve(response)
    }

    return resolve({
      status: httpStatus.BAD_REQUEST,
      message: 'Failed uploading image'
    })
  })
})

const saveImageToModels = async (user, filename) => {
  let data = {}

  data = { profile_url: filename }
  await User.update(data, { where: { id: user.id } })

  return { status: httpStatus.OK, message: 'Image uploaded successfully', profile_url: config.server_url + filename }
}

const sendOTPToMobile = async (user, mobileNo) => {
  const token = await tokenService.generateMobileNoVerificationToken(user)
  if (token.status !== 200) { throw new ApiError(token.status, token.message) }

  const data = {
    method: 'post',
    url: config.sendOTPHost,
    data: {
      to: mobileNo,
      template: 'OTP_TEMPLATE',
      parameters: [token.otp]
    }
  }

  await axios(data)
    .then(function (response) {
      logger.info('Sent OTP to mobile ', mobileNo)
    })
    .catch(function (error) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed sending OTP. Try again')
    })
}

module.exports = {
  createUser,
  queryUsers,
  getUserById,
  getUserByMobileNo,
  updateUser,
  deleteUserById,
  fileUpload,
  updateUserById
}
