const express = require("express");
const {
  getAllExperiences,
  getExperiencesByRoadSegment,
  getExperienceStats
} = require("../controllers/experienceController");

const router = express.Router();

router.get("/", getAllExperiences);
router.get("/stats", getExperienceStats);
router.get("/road/:roadSegmentId", getExperiencesByRoadSegment);

module.exports = router;