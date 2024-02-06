const httpStatus = require('http-status')

const catchAsync = require('../utils/catchAsync')
const { jobService } = require('../services')

const getAllJobs = catchAsync(async (req, res) => {
  const jobs = await jobService.getAllJobs(req.user)
  res.status(httpStatus.OK).send(jobs)
})

const getJob = catchAsync(async (req, res) => {
  const job = await jobService.getJobById(req.params.id)
  res.status(httpStatus.OK).send(job)
})

module.exports = {
  getAllJobs,
  getJob
}
