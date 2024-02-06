const httpStatus = require('http-status')
const catchAsync = require('../utils/catchAsync')
const { authService, tokenService } = require('../services')
const { CUSTOMER_SUPPORT_PHONE_NUMBER } = require('../config/config')

const sendOtp = catchAsync(async (req, res) => {
  const { mobileNo } = req.body
  await authService.sendOTP(mobileNo)
  res
    .status(httpStatus.OK)
    .send({ message: 'OTP sent successfully' })
})

const verifyOtp = catchAsync(async (req, res) => {
  const payload = req.body
  const user = await authService.verifyOTP(payload)
  if (user) {
    const tokens = await tokenService.generateAuthTokens(user)
    res
      .cookie('refreshToken', tokens.refresh.token, {
        maxAge: tokens.refresh.maxAge,
        httpOnly: true,
        sameSite: 'none',
        secure: true
      })
      .send({ token: tokens.access, customerSupport: CUSTOMER_SUPPORT_PHONE_NUMBER })
  } else {
    res
      .status(httpStatus.INTERNAL_SERVER_ERROR)
      .send({ message: 'Failed OTP verification' })
  }
})

module.exports = {
  sendOtp,
  verifyOtp

}
