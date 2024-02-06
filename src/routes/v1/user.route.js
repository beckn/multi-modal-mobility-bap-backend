const express = require('express')
const auth = require('../../middlewares/auth')
const validate = require('../../middlewares/validate')
const userValidation = require('../../validations/user.validation')
const userController = require('../../controllers/user.controller')

const router = express.Router()

router
  .route('/')
  .get(auth(), validate(userValidation.getUser), userController.getUser)
  .put(auth(), validate(userValidation.updateUser), userController.updateUser)
  .delete(auth(), validate(userValidation.deleteUser), userController.deleteUser)

//When user updates email
router
  .route('/verify/mobile-number')
  .post(auth(), validate(userValidation.updateUser), userController.verifyOTP)

router
  .route('/send-otp')
  .post(auth(), validate(userValidation.updateUser), userController.sendOTP)

router
  .route('/upload/profile-pic')
  .post(auth(), validate(), userController.profilepicUpload)

module.exports = router
