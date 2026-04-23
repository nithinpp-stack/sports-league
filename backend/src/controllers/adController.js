import Ad from '../models/Ad.js';

export const listAds = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.placement) filter.placement = req.query.placement;
    if (req.query.sport) filter.sport = req.query.sport;

    const [ads, total] = await Promise.all([
      Ad.find(filter)
        .populate('createdBy', 'name email')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Ad.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: { ads },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

export const createAd = async (req, res, next) => {
  try {
    const ad = await Ad.create({
      ...req.body,
      createdBy: req.user.id,
    });
    return res.status(201).json({ success: true, data: { ad } });
  } catch (err) {
    next(err);
  }
};

export const updateAd = async (req, res, next) => {
  try {
    const ad = await Ad.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    return res.json({ success: true, data: { ad } });
  } catch (err) {
    next(err);
  }
};

export const deleteAd = async (req, res, next) => {
  try {
    const ad = await Ad.findByIdAndDelete(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    return res.json({ success: true, data: { message: 'Ad deleted' } });
  } catch (err) {
    next(err);
  }
};

export const getPublicAds = async (req, res, next) => {
  try {
    const now = new Date();
    const filter = {
      status: 'active',
      $or: [
        { startDate: null, endDate: null },
        { startDate: { $lte: now }, endDate: null },
        { startDate: null, endDate: { $gte: now } },
        { startDate: { $lte: now }, endDate: { $gte: now } },
      ],
    };

    if (req.query.placement) filter.placement = req.query.placement;
    if (req.query.sport) filter.sport = req.query.sport;

    const ads = await Ad.find(filter).sort({ priority: -1 });

    return res.json({ success: true, data: { ads } });
  } catch (err) {
    next(err);
  }
};
