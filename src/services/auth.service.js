const httpStatus = require('http-status')
const tokenService = require('./token.service')
const userService = require('./user.service')
const { models } = require('../models')
const ApiError = require('../utils/ApiError')
const { sendTextMessage } = require('../utils/misc')
const { tokenTypes } = require('../config/tokens')
const { logger } = require('../config/logger')

const { Token } = models

const sendOTP = async (mobileNo) => {
  let user = await userService.getUserByMobileNo(mobileNo)
  if (!user) {
    user = await userService.createUser({ mobileNo })
    if (!user) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed sending OTP. Try again')
    }
  }
  await sendOTPToMobile(user, mobileNo)
}

const sendOTPToMobile = async (user, mobileNo) => {
  const token = await tokenService.generateMobileNoVerificationToken(user)
  if (token.status !== 200) { throw new ApiError(token.status, token.message) }

  const response = await sendTextMessage(token.otp, mobileNo)
  if (!response) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed sending OTP. Try again')
  }
}

const verifyOTP = async (payload, user, updateMobileNo = false) => {
  if (!user) {
    user = await userService.getUserByMobileNo(payload.mobileNo)
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Invalid mobile number')
    }
  }

  const otpVerificationTokenDoc = await tokenService.verifyOTP(payload.otp, tokenTypes.OTP_VERIFICATION, user.id)
  if (!otpVerificationTokenDoc) { throw new ApiError(httpStatus.BAD_REQUEST, 'Failed OTP verification') }
  try {
    await Token.destroy({ where: { userId: user.id, type: tokenTypes.OTP_VERIFICATION } })
    const updatedUser = await userService.updateUserById(user.id, { isUserVerified: true, mobileNo: payload.mobileNo })
    return updatedUser
  } catch (error) {
    logger.error('error is :' + error)
    throw new ApiError(httpStatus.BAD_REQUEST, 'Failed OTP verification')
  }
}

/**
 * Logout
 * @param {string} refreshToken
 * @returns {Promise}
 */
const logout = async (refreshToken) => {
  const refreshTokenDoc = await Token.findOne({
    where: { token: refreshToken, type: tokenTypes.REFRESH, blacklisted: false }
  })
  if (!refreshTokenDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Not found')
  }
  await refreshTokenDoc.destroy()
}

/**
 * Refresh auth tokens
 * @param {string} refreshToken
 * @returns {Promise<Object>}
 */
const refreshAuth = async (refreshToken) => {
  try {
    const refreshTokenDoc = await tokenService.verifyToken(refreshToken, tokenTypes.REFRESH)
    const user = await userService.getUserById(refreshTokenDoc.user)
    if (!user) {
      throw new Error()
    }
    await refreshTokenDoc.destroy()
    return { user, tokens: await tokenService.generateAuthTokens(user) }
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate')
  }
}

/**
 * Reset password
 * @param {string} resetPasswordToken
 * @param {string} newPassword
 * @returns {Promise}
 */
const resetPassword = async (resetPasswordToken, newPassword) => {
  try {
    const resetPasswordTokenDoc = await tokenService.verifyToken(resetPasswordToken, tokenTypes.RESET_PASSWORD)
    const user = await userService.getUserById(resetPasswordTokenDoc.user)
    if (!user) {
      throw new Error()
    }
    await Token.deleteMany({ where: { user: user.id, type: tokenTypes.RESET_PASSWORD } })
    await userService.updateUserById(user.id, { password: newPassword })
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed')
  }
}

/**
 * Email verification
 * @param {string} emailVerificationToken
 * @returns {Promise}
 */
const emailVerification = async (emailVerificationToken) => {
  try {
    const emailVerificationTokenDoc = await tokenService.verifyToken(emailVerificationToken, tokenTypes.EMAIL_VERIFICATION)
    let user = await userService.getUserById(emailVerificationTokenDoc.user)
    if (!user) {
      throw new Error()
    }
    await Token.deleteMany({ user: user.id, type: tokenTypes.EMAIL_VERIFICATION })
    user = await userService.updateUserById(user.id, { isEmailVerified: true })
    return user.user
  } catch (error) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Email verification failed')
  }
}

module.exports = {
  sendOTP,
  verifyOTP,
  logout,
  refreshAuth,
  resetPassword,
  emailVerification,
  sendOTPToMobile
}
