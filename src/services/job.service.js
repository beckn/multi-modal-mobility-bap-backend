const httpStatus = require('http-status')
const { models } = require('../models')
const ApiError = require('../utils/ApiError')

const { Job } = models
/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */

const createJob = async (payload) => {
  await Job.destroy({ where: { userId: payload.userId } })
  const job = await Job.create(payload)
  return job
}

const getJobById = async (id) => {
  return Job.findByPk(id)
}

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */

const getAllJobs = async (user) => {
  return Job.findOne({ where: { userId: user.id } })
}

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateJobById = async (id, updateBody) => {
  const job = await getJobById(id)
  if (!job) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Job not found')
  }
  Object.assign(job, updateBody)
  await job.save()
  return job
}

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteJobById = async (id) => {
  const job = await getJobById(id)
  if (!job) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Job not found')
  }
  await Job.destroy(id)
  return job
}

module.exports = {
  createJob,
  getAllJobs,
  getJobById,
  updateJobById,
  deleteJobById
}
