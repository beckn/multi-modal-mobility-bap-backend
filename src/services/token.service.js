const jwt = require('jsonwebtoken')
const moment = require('moment')
const config = require('../config/config')
const { models } = require('../models')
const { tokenTypes } = require('../config/tokens')
const { RESEND_COUNT, NORESEND_WINDOW } = require('../config/config')

const { Token } = models
/**
 * Generate token
 * @param {ObjectId} userId
 * @param {Moment} expires
 * @param {string} [secret]
 * @returns {string}
 */
const generateToken = (userId, expires, type, secret = config.jwt.secret) => {
  const payload = {
    sub: userId,
    iat: moment().unix(),
    exp: expires.unix(),
    type
  }
  return jwt.sign(payload, secret)
}

/**
 * Save a token
 * @param {string} token
 * @param {ObjectId} userId
 * @param {Moment} expires
 * @param {string} type
 * @param {boolean} [blacklisted]
 * @returns {Promise<Token>}
 */
const saveToken = async (token, userId, expires, type, blacklisted = false, count = 0) => {
  const tokenDoc = await Token.create({
    token,
    userId,
    expires: expires.toDate(),
    type,
    otpCount: count,
    blacklisted
  })
  return tokenDoc
}

/**
 * Verify token and return token doc (or throw an error if it is not valid)
 * @param {string} token
 * @param {string} type
 * @returns {Promise<Token>}
 */

const verifyOTP = async (otp, type, userId) => {
  const tokenDoc = await Token.findOne({ where: { token: otp, type, userId } })
  return tokenDoc
}

/**
 * Generate auth tokens
 * @param {User} user
 * @returns {Promise<Object>}
 */
const generateAuthTokens = async (user) => {
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes')
  const accessToken = generateToken(user.id, accessTokenExpires, tokenTypes.ACCESS)

  const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days')
  const refreshTokenMaxAge = refreshTokenExpires.diff(moment().add(5, 'minutes'))
  const refreshToken = generateToken(user.id, refreshTokenExpires, tokenTypes.REFRESH)
  await saveToken(refreshToken, user.id, refreshTokenExpires, tokenTypes.REFRESH)

  return {
    access: {
      token: accessToken,
      expires: accessTokenExpires.toDate()
    },
    refresh: {
      token: refreshToken,
      maxAge: refreshTokenMaxAge
    }
  }
}

/**
 * Generate email verification token
 * @param {string} email
 * @returns {Promise<string>}
 */
const generateMobileNoVerificationToken = async (user) => {
  const sentTokens = await Token.findOne({ where: { userId: user.id, type: tokenTypes.OTP_VERIFICATION } })
  if (sentTokens && sentTokens.otpCount >= RESEND_COUNT) {
    const lastSentTime = moment().diff(moment(sentTokens.updatedAt), 'minutes')

    if (lastSentTime < NORESEND_WINDOW) return { status: 400, message: 'Max attempts reached' }
    else {
      sentTokens.otpCount = 0
    }
  }
  let otpCount = 0
  if (sentTokens) { otpCount = sentTokens.otpCount + 1 }
  const expires = moment().add(config.jwt.userVerificationExpirationMins, 'minutes')
  const digits = '0123456789'
  let otp = ''
  for (let i = 0; i < config.otpLength; i += 1) {
    otp += digits[Math.floor(Math.random() * 10)]
  }
  await Token.destroy({ where: { userId: user.id, type: tokenTypes.OTP_VERIFICATION } })
  await saveToken(otp, user.id, expires, tokenTypes.OTP_VERIFICATION, null, otpCount)
  return { status: 200, otp }
}

module.exports = {
  generateToken,
  saveToken,
  verifyOTP,
  generateAuthTokens,
  generateMobileNoVerificationToken
}
