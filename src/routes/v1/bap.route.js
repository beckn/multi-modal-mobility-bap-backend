const express = require('express')
const auth = require('../../middlewares/auth')
const validate = require('../../middlewares/validate')
const bapAPIValidation = require('../../validations/bap.validation')
const bapController = require('../../controllers/bap.controller')

const router = express.Router()

router
  .route('/search')
  .post(auth(), validate(bapAPIValidation.search), bapController.getAllModals)

router
  .route('/select')
  .post(auth(), validate(bapAPIValidation.select), bapController.selectRide)

router
  .route('/confirm')
  .post(auth(), validate(bapAPIValidation.select), bapController.confirmRide)

router
  .route('/book-ticket')
  .post(auth(), validate(bapAPIValidation.select), bapController.bookBusTicket)

router
  .route('/cancel')
  .post(auth(), validate(bapAPIValidation.select), bapController.cancelRide)

router
  .route('/auto/track')
  .post(auth(), validate(bapAPIValidation.select), bapController.trackRide)

router
  .route('/auto/status')
  .post(auth(), validate(bapAPIValidation.select), bapController.rideStatus)

router
  .route('/rating')
  .post(auth(), validate(bapAPIValidation.select), bapController.rateRide)

router
  .route('/rides/setType')
  .get(validate(), bapController.setModeType)

router
  .route('/history')
  .get(auth(), validate(), bapController.getRideHistory)

router
  .route('/rides/status')
  .get(auth(), validate(), bapController.getRidesStatusList)

router
  .route('/rides/bus/status')
  .post(auth(), validate(), bapController.updateBusStatus)

router
  .route('/update')
  .post(auth(), validate(), bapController.getUpdates)

router
  .route('/bus/alternates')
  .post(auth(), validate(), bapController.getBusAlternates)


module.exports = router

/**
 * @swagger
 * tags:
 *   name: Core APIs
 *   description: core
 */

/**
 * @swagger
 * path:
 *  /modal/search:
 *    post:
 *      summary: Search available transport options
 *      tags: [Core APIs]
 *      security:
 *        - bearerAuth: []
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - start
 *                - end
 *              properties:
 *                start:
 *                  type: string
 *                end:
 *                  type: string
 *
 *              example:
 *                start: "19.95815,73.84124"
 *                end: "20.00882,73.81456"
 *
 *      responses:
 *        "200":
 *          description: Job added successfully
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  token:
 *                      type: object
 *                      properties:
 *                          id:
 *                              type: string
 *                          status:
 *                              type: string
 *                          userId:
 *                              type: string
 *                          response:
 *                              type: object
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

/**
 * @swagger
 * path:
 *  /modal/select:
 *    post:
 *      summary: Select transport option
 *      tags: [Core APIs]
 *      security:
 *        - bearerAuth: []
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - routeId
 *
 *              properties:
 *                routeId:
 *                  type: string

 *              example:
 *                routeId: "025a3ceb-b4d4-43ac-81aa-ff5196ddef1b"
 *
 *
 *      responses:
 *        "200":
 *          description: Selected successfully
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  token:
 *                      type: object
 *                      properties:
 *                          routeId:
 *                              type: string
 *                          routeType:
 *                              type: string
 *                          userId:
 *                              type: string
 *                          response:
 *                              type: object
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

/**
 * @swagger
 * path:
 *  /modal/confirm:
 *    post:
 *      summary: Confirm ride
 *      tags: [Core APIs]
 *      security:
 *        - bearerAuth: []
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - routeId
 *              properties:
 *                routeId:
 *                  type: string
 *              routeType:
 *                  type: string
 *              id:
 *                  type: string
 *
 *              example:
 *                routeId: "15443563-7f58-4a14-80f3-13218a248bcd"
 *                routeType: "MULTI"
 *                id: "3"
 *
 *      responses:
 *        "200":
 *          description: Confirmed successfully
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  token:
 *                      type: object
 *                      properties:
 *                          id:
 *                              type: string
 *                          status:
 *                              type: string
 *                          userId:
 *                              type: string
 *                          response:
 *                              type: object
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

/**
 * @swagger
 * path:
 *  /modal/cancel:
 *    post:
 *      summary: Cancel auto ride
 *      tags: [Core APIs]
 *      security:
 *        - bearerAuth: []
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - routeId
 *                - orderId
 *              properties:
 *                routeId:
 *                  type: string
 *                orderId:
 *                  type: string

 *
 *              example:
 *                routeId: "5777a0bf-9a08-49aa-a97d-1e5561a9622e"
 *                order_id: "7751bd26-3fdc-47ca-9b64-e998dc5abe68"
 *
 *      responses:
 *        "200":
 *          description: Cancelled successfully
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  token:

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
 *  /modal/history:
 *    get:
 *      summary: Lists user journey history
 *      tags: [History & status]
 *      security:
 *        - bearerAuth: []
 *      responses:
 *        "200":
 *          description: Fetched history successfully
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  token:

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
 *  /modal/rating:
 *    post:
 *      summary: Update user rating
 *      tags: [History & status]
 *      security:
 *        - bearerAuth: []
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - routeId
 *              properties:
 *                routeId:
 *                  type: string
 *                rating:
 *                  type: string
 *                feedback :
 *                  type: array
 *                  items:
 *                    type: string
 *                comments:
 *                    type: string
 *                skip:
 *                    type: boolean

 *
 *              example:
 *                routeId: "5777a0bf-9a08-49aa-a97d-1e5561a9622e"
 *                order_id: "7751bd26-3fdc-47ca-9b64-e998dc5abe68"
 *
 *      responses:
 *        "200":
 *          description: Updated
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  token:

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
 *  /modal/rides/status:
 *    get:
 *      summary: Get last ride status
 *      tags: [History & status]
 *      security:
 *        - bearerAuth: []
 *      responses:
 *        "200":
 *          description: Fetched
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  token:

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
 *  /modal/rides/bus/status:
 *    post:
 *      summary: Update bus status
 *      tags: [History & status]
 *      security:
 *        - bearerAuth: []
 *      requestBody:
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              required:
 *                - routeId
 *                - order_id
 *              properties:
 *                routeId:
 *                  type: string
 *                order_id:
 *                  type: string
 *                status :
 *                  type: string

 *
 *              example:
 *                routeId: "5777a0bf-9a08-49aa-a97d-1e5561a9622e"
 *                order_id: "7751bd26-3fdc-47ca-9b64-e998dc5abe68"
 *                status: "RIDE_COMPLETED"
 *
 *      responses:
 *        "200":
 *          description: Updatedxc
 *          content:
 *            application/json:
 *              schema:
 *                type: object
 *                properties:
 *                  token:

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
