const httpStatus = require('http-status')
const config = require('../config/config')
const catchAsync = require('../utils/catchAsync')
const { userService, authService, tokenService } = require('../services')

const createUser = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body)
  res.status(httpStatus.CREATED).send(user)
})

const getUser = catchAsync(async (req, res) => {
  const user = req.user
  if (user.profile_url) { user.profile_url = config.server_url + 'profile_images/' + user.profile_url }
  res.send(req.user)
})

const updateUser = catchAsync(async (req, res) => {
  const userOld = req.user
  const response = await userService.updateUser(userOld, req.body)
  const details = response.user.dataValues
  details.otp = response.otpSent
  res.send(details)
})

const deleteUser = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.user.id)
  if (user) await userService.deleteUserById(req.user.id)
  res.status(httpStatus.NO_CONTENT).send()
})

const profilepicUpload = catchAsync(async (req, res) => {
  const uploadResponse = await userService.fileUpload(req, res)
  res.status(uploadResponse.status).send({ message: uploadResponse.message })
})

const verifyOTP = catchAsync(async (req, res) => {
  const payload = req.body

  const user = await authService.verifyOTP(payload, req.user, true)
  if (user) {
    const tokens = await tokenService.generateAuthTokens(user)
    res
      .cookie('refreshToken', tokens.refresh.token, {
        maxAge: tokens.refresh.maxAge,
        httpOnly: true,
        sameSite: 'none',
        secure: true
      })
      .send({ token: tokens.access, customerSupport: config.CUSTOMER_SUPPORT_PHONE_NUMBER })
  } else {
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send({ message: 'Failed OTP verification' })
  }
})

const sendOTP = catchAsync(async (req, res) => {
  const payload = req.body
  await authService.sendOTPToMobile(req.user, payload.mobileNo)
  res
    .status(httpStatus.OK)
    .send({ message: 'Sent OTP successfully' })
})

module.exports = {
  createUser,
  getUser,
  updateUser,
  deleteUser,
  profilepicUpload,
  verifyOTP,
  sendOTP
}
