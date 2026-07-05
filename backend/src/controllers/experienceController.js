const Experience = require("../models/Experience");

const getAllExperiences = async (req, res) => {
  try {
    const experiences = await Experience.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      count: experiences.length,
      data: experiences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch experiences",
      error: error.message
    });
  }
};

const getExperiencesByRoadSegment = async (req, res) => {
  try {
    const { roadSegmentId } = req.params;

    const experiences = await Experience.find({ roadSegmentId })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      roadSegmentId,
      count: experiences.length,
      data: experiences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch road segment experiences",
      error: error.message
    });
  }
};

const getExperienceStats = async (req, res) => {
  try {
    const topSegments = await Experience.aggregate([
      { $group: { _id: "$roadSegmentId", count: { $sum: 1 }, avgRisk: { $avg: "$riskScore" } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const eventBreakdown = await Experience.aggregate([
      { $group: { _id: "$eventType", count: { $sum: 1 } } }
    ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dailyTrends = await Experience.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          avgRisk: { $avg: "$riskScore" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      stats: {
        topSegments,
        eventBreakdown,
        dailyTrends
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch experience stats",
      error: error.message
    });
  }
};

module.exports = {
  getAllExperiences,
  getExperiencesByRoadSegment,
  getExperienceStats
};