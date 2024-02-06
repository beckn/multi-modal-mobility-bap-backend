const express = require('express')
const auth = require('../../middlewares/auth')
const validate = require('../../middlewares/validate')
const jobController = require('../../controllers/job.controller')

const router = express.Router()

router
  .route('/')
  .get(auth(), validate(), jobController.getAllJobs)

router
  .route('/:id')
  .get(auth(), validate(), jobController.getJob)

module.exports = router

/**
 * @swagger
 * path:
 *  /job/{id}:
 *    get:
 *      summary: Get job details
 *      tags: [Core APIs]
 *      security:
 *        - bearerAuth: []
 *      parameters:
 *        - in: path
 *          name: id
 *          required: true
 *          schema:
 *            type: string
 *          description: Job id
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
