require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { PythonShell } = require('python-shell');
const googleTrends = require('google-trends-api');
const axios = require('axios');
const redis = require('redis');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());


const redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const Simulation = mongoose.model('Simulation', new mongoose.Schema({
  product: String,
  subcategory: String,
  location: String,
  adType: String,
  adApproach: String,
  roi: Number,
  revenue: Number,
  cost: Number,
  analysis: [String],
  suggestions: [String],
}));

async function getAdCost(adType, location, subscribers = 0, adApproach = '') {
  let baseCost = 1000;
  if (adType === 'youtube') {
    if (subscribers < 10000) baseCost = 200;
    else if (subscribers < 100000) baseCost = 800;
    else if (subscribers < 1000000) baseCost = 5000;
    else baseCost = 20000;
  } else if (adType === 'newspaper') {
    baseCost = location.includes('India') ? 3000 : 5000;
  } else if (adType === 'ppc') {
    try {
      const res = await axios.get('https://googleads.googleapis.com/v17/customers/listAccessibleCustomers', {
        headers: { Authorization: `Bearer ${process.env.GOOGLE_ADS_TOKEN}` },
      });
      baseCost = 2;
    } catch (err) {
      baseCost = 2;
    }
  }

  const approachMultipliers = {
    informative: 1.0,
    persuasive: 1.1,
    reminder: 0.9,
    comparative: 1.2,
    emotive: 1.3,
  };
  return baseCost * (approachMultipliers[adApproach] || 1.0);
}

async function pollTrends(location, keyword) {
  const cacheKey = `trends:${location}:${keyword}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return parseFloat(cached);

  try {
    const trends = await googleTrends.interestOverTime({ keyword, geo: location });
    const value = JSON.parse(trends).default.timelineData[0].value[0];
    await redisClient.setEx(cacheKey, 3600, value.toString());
    return value;
  } catch (err) {
    return Math.random() * 100;
  }
}

async function getPolicyImpact(location, productCategory) {
  const cacheKey = `policy:${location}:${productCategory}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return parseFloat(cached);

  try {
    const res = await axios.get(`https://newsapi.org/v2/everything?q=${productCategory}+policy+${location}&apiKey=${process.env.NEWS_API_KEY}`);
    const articles = res.data.articles.slice(0, 5);
    const sentiment = articles.reduce((acc, article) => acc + (article.description?.includes('restrict') ? -0.1 : 0.1), 0.8);
    const policyImpact = Math.min(Math.max(sentiment, 0), 1);
    await redisClient.setEx(cacheKey, 3600, policyImpact.toString());
    return policyImpact;
  } catch (err) {
    return location.includes('India') && productCategory === 'hardware' ? 0.9 : 0.8;
  }
}

async function runSimulation({ productCategory, subcategory, location, competitors, adType, adApproach, subscribers }) {
  const adCost = await getAdCost(adType, location, subscribers, adApproach);
  const competitorCount = competitors.split(',').length;
  const factors = {
    culturalTrend: await pollTrends(location, productCategory),
    population: 1000000 + Math.random() * 500000,
    searchTrends: await pollTrends(location, `${productCategory} ${subcategory} buy`),
    competitorCount,
    policyImpact: await getPolicyImpact(location, productCategory),
  };

  const options = {
    args: [JSON.stringify({ adCost, factors, adApproach })],
  };

  return new Promise((resolve, reject) => {
    PythonShell.run('../ml-service/app.py', options).then(results => {
      const { roi, revenue, cost, featureImpact, analysis, suggestions } = JSON.parse(results[0]);
      const trend = [{ date: 'Now', roi }, { date: 'Next Hour', roi: roi * 1.05 }];
      resolve({ roiTrend: trend, factors, featureImpact, analysis, suggestions, adCost, revenue });
    }).catch(reject);
  });
}

app.post('/estimate-cost', async (req, res) => {
  const { adType, adApproach, subscribers, location } = req.body;
  if (!adType || !adApproach) {
    return res.status(400).json({ error: 'Ad type and approach are required' });
  }
  const cost = await getAdCost(adType, location, subscribers, adApproach);
  res.json({ cost });
});

app.post('/simulate', async (req, res) => {
  const { productCategory, subcategory, location, competitors, adType, adApproach, subscribers } = req.body;

  if (!productCategory || !subcategory || !location || !competitors || !adType || !adApproach) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const result = await runSimulation({ productCategory, subcategory, location, competitors, adType, adApproach, subscribers });
    const { roi, revenue, cost, analysis, suggestions } = JSON.parse((await PythonShell.run('../ml-service/app.py', {
      args: [JSON.stringify({
        adCost: result.adCost,
        factors: result.factors,
        adApproach
      })],
    }))[0]);

    new Simulation({ product: productCategory, subcategory, location, adType, adApproach, roi, revenue, cost, analysis, suggestions }).save();
    io.emit('update', { factors: result.factors, roi });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

let lastFactors = {};
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  let interval;

  socket.on('start-polling', async (data) => {
    const { productCategory, subcategory, location, adType, adApproach, subscribers } = data;
    interval = setInterval(async () => {
      const result = await runSimulation({ productCategory, subcategory, location, competitors: 'Generic', adType, adApproach, subscribers });
      const { factors, roi } = result;

      if (Math.abs(factors.culturalTrend - (lastFactors.culturalTrend || 0)) > 5 ||
          Math.abs(factors.searchTrends - (lastFactors.searchTrends || 0)) > 5) {
        io.emit('update', { factors, roi });
        lastFactors = factors;
      }
    }, 30000);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    clearInterval(interval);
  });
});

server.listen(4000, () => console.log('Backend on 4000'));