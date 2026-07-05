const express = require("express");
const { getGraphOverview, getRiskClusters, getSimilarSegments } = require("../controllers/graphController");

const router = express.Router();

router.get("/", getGraphOverview);
router.get("/clusters", getRiskClusters);
router.get("/similar/:roadSegmentId", getSimilarSegments);

module.exports = router;