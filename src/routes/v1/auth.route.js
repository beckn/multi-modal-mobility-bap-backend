const express = require('express')
const validate = require('../../middlewares/validate')
const authValidation = require('../../validations/auth.validation')
const authController = require('../../controllers/auth.controller')

const router = express.Router()

router.post('/otp/send', validate(authValidation.sendOtp), authController.sendOtp)
router.post('/otp/verify', validate(authValidation.verifyOtp), authController.verifyOtp)

module.exports = router

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication
 */

/**
 * @swagger
 * path:
 *  /auth/otp/send:
 *    post:
 *      summary: Send otp to given mobile number
 *      tags: [Auth]
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - mobileNo
 *              properties:
 *                mobileNo:
 *                  type: string
 *
 *              example:
 *                mobileNo: "6756665577"
 *
 *      responses:
 *        "200":
 *          description: Sent OTP successfully
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  message:
 *                      type: string
 *        "400":
 *          description: Invalid input
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  message:
 *                      type: string
 */

/**
 * @swagger
 * path:
 *  /auth/otp/verify:
 *    post:
 *      summary: Verify otp sent to mobile number
 *      tags: [Auth]
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - mobileNo
 *                - otp
 *              properties:
 *                mobileNo:
 *                  type: string
 *                otp:
 *                  type: string
 *
 *              example:
 *                mobileNo: "6756665577"
 *
 *      responses:
 *        "200":
 *          description: Verified OTP successfully
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  token:
 *                      type: object
 *                      properties:
 *                          token:
 *                              type: string
 *                          expires:
 *                              type: string
 *
 *        "400":
 *          description: Invalid input
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  message:
 *                      type: string
 */
