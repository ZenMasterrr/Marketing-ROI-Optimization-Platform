'use client';
import { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import GaugeChart from 'react-gauge-chart';
import io from 'socket.io-client';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

const socket = io('http://localhost:4000');


interface Categories {
  [key: string]: string[];
  hardware: string[];
  software: string[];
  service: string[];
}

const categories: Categories = {
  hardware: ['electronics', 'furniture', 'appliances'],
  software: ['app', 'website', 'saas'],
  service: ['consulting', 'freelance', 'education'],
};

const adApproaches = [
  'informative',
  'persuasive',
  'reminder',
  'comparative',
  'emotive',
];


interface UpdateHistoryEntry {
  timestamp: string;
  factors: {
    culturalTrend: number;
    population: number;
    searchTrends: number;
    competitorCount: number;
    policyImpact: number;
  };
  roi: number;
}


interface Errors {
  productCategory?: string;
  subcategory?: string;
  location?: string;
  competitors?: string;
  adType?: string;
  adApproach?: string;
  subscribers?: string;
  api?: string;
}


interface FeatureImpact {
  [key: string]: number;
}

export default function Home() {
  const [productCategory, setProductCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [location, setLocation] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [adType, setAdType] = useState('');
  const [adApproach, setAdApproach] = useState('');
  const [subscribers, setSubscribers] = useState(0);
  const [adCost, setAdCost] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [roiData, setRoiData] = useState([{ date: 'Now', roi: 0 }]);
  const [factors, setFactors] = useState({ culturalTrend: 50, population: 1000000, searchTrends: 50, competitorCount: 0, policyImpact: 0 });
  const [featureImpact, setFeatureImpact] = useState<FeatureImpact>({});
  const [analysis, setAnalysis] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [updateHistory, setUpdateHistory] = useState<UpdateHistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(true);

  useEffect(() => {
    socket.on('update', (data: { factors: UpdateHistoryEntry['factors']; roi: number }) => {
      setFactors((prev) => ({ ...prev, ...data.factors }));
      if (data.roi) {
        setRoiData((prev) => [...prev, { date: new Date().toLocaleTimeString(), roi: data.roi }].slice(-10));
        setUpdateHistory((prev) => [
          ...prev,
          { timestamp: new Date().toLocaleTimeString(), factors: data.factors, roi: data.roi },
        ].slice(-5));
      }
    });

    if (productCategory && subcategory && location && adType && adApproach) {
      socket.emit('start-polling', { productCategory, subcategory, location, adType, adApproach, subscribers });
    }

    return () => {
      socket.off('update');
      socket.disconnect();
    };
  }, [productCategory, subcategory, location, adType, adApproach, subscribers]);

  useEffect(() => {
    if (adType && adApproach) {
      fetchCostEstimate();
    } else {
      setAdCost(0);
    }
  }, [adType, adApproach, subscribers, location]);

  const fetchCostEstimate = async () => {
    try {
      const res = await fetch('/api/estimate-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adType, adApproach, subscribers, location }),
      });
      const data = await res.json();
      setAdCost(data.cost || 0);
    } catch (err) {
      setErrors((prev) => ({ ...prev, api: 'Failed to fetch cost estimate' }));
    }
  };

  const validateInputs = () => {
    const newErrors: Errors = {};
    if (!productCategory) newErrors.productCategory = 'Product category is required';
    if (!subcategory) newErrors.subcategory = 'Subcategory is required';
    if (!location) newErrors.location = 'Location is required';
    if (!competitors) newErrors.competitors = 'At least one competitor is required';
    if (!adType) newErrors.adType = 'Ad type is required';
    if (!adApproach) newErrors.adApproach = 'Ad approach is required';
    if (adType === 'youtube' && subscribers <= 0) newErrors.subscribers = 'Subscribers must be greater than 0';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateInputs()) return;

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productCategory, subcategory, location, competitors, adType, adApproach, subscribers }),
      });
      const data = await res.json();
      if (data.error) {
        setErrors((prev) => ({ ...prev, api: data.error }));
        return;
      }
      setRoiData(data.roiTrend);
      setFactors(data.factors);
      setFeatureImpact(data.featureImpact);
      setAnalysis(data.analysis);
      setSuggestions(data.suggestions);
      setAdCost(data.adCost);
      setRevenue(data.revenue);
      setUpdateHistory([{ timestamp: new Date().toLocaleTimeString(), factors: data.factors, roi: data.roiTrend[0].roi }]);
      setErrors({});
    } catch (err) {
      setErrors((prev) => ({ ...prev, api: 'Failed to connect to backend' }));
    }
  };

  const chartData = {
    labels: roiData.map((d) => d.date),
    datasets: [
      {
        label: 'ROI Trend (%)',
        data: roiData.map((d) => d.roi * 100),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const impactChartData = {
    labels: Object.keys(featureImpact).map((key) => key.replace('_', ' ').toUpperCase()),
    datasets: [
      {
        label: 'Factor Importance (%)',
        data: Object.values(featureImpact).map((v) => v * 100),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: '#3b82f6',
        borderWidth: 1,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center mb-6 sm:mb-8 text-gray-800">Marketing Lab Simulator</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg transform transition-all duration-300 hover:shadow-xl">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-700">Input Parameters</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600">Product Category</label>
                <select
                  value={productCategory}
                  onChange={(e) => {
                    setProductCategory(e.target.value);
                    setSubcategory('');
                  }}
                  className={`w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${errors.productCategory ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">Select Product Category</option>
                  {Object.keys(categories).map((cat) => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
                {errors.productCategory && <p className="text-red-500 text-xs mt-1">{errors.productCategory}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Subcategory</label>
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className={`w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${errors.subcategory ? 'border-red-500' : 'border-gray-300'}`}
                  disabled={!productCategory}
                >
                  <option value="">Select Subcategory</option>
                  {productCategory &&
                    categories[productCategory].map((sub: string) => (
                      <option key={sub} value={sub}>{sub.charAt(0).toUpperCase() + sub.slice(1)}</option>
                    ))}
                </select>
                {errors.subcategory && <p className="text-red-500 text-xs mt-1">{errors.subcategory}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Location</label>
                <input
                  type="text"
                  placeholder="e.g., US, India"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={`w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${errors.location ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Competitors (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., Company A, Company B"
                  value={competitors}
                  onChange={(e) => setCompetitors(e.target.value)}
                  className={`w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${errors.competitors ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.competitors && <p className="text-red-500 text-xs mt-1">{errors.competitors}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Ad Type</label>
                <select
                  value={adType}
                  onChange={(e) => setAdType(e.target.value)}
                  className={`w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${errors.adType ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">Select Ad Type</option>
                  <option value="youtube">YouTube Influencer</option>
                  <option value="newspaper">Newspaper Print</option>
                  <option value="ppc">PPC (Google Ads)</option>
                </select>
                {errors.adType && <p className="text-red-500 text-xs mt-1">{errors.adType}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">Ad Approach</label>
                <select
                  value={adApproach}
                  onChange={(e) => setAdApproach(e.target.value)}
                  className={`w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${errors.adApproach ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">Select Ad Approach</option>
                  {adApproaches.map((approach) => (
                    <option key={approach} value={approach}>{approach.charAt(0).toUpperCase() + approach.slice(1)}</option>
                  ))}
                </select>
                {errors.adApproach && <p className="text-red-500 text-xs mt-1">{errors.adApproach}</p>}
              </div>
              {adType === 'youtube' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600">Influencer Subscribers</label>
                  <input
                    type="number"
                    placeholder="e.g., 10000"
                    value={subscribers}
                    onChange={(e) => setSubscribers(Number(e.target.value))}
                    className={`w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all ${errors.subscribers ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.subscribers && <p className="text-red-500 text-xs mt-1">{errors.subscribers}</p>}
                </div>
              )}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="font-semibold text-blue-800">Estimated Ad Cost</p>
                <p className="text-lg font-bold text-blue-900">${adCost.toFixed(2)}</p>
              </div>
              <button
                onClick={handleSubmit}
                className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-105"
              >
                Simulate ROI
              </button>
              {errors.api && <p className="text-red-500 text-xs mt-2">{errors.api}</p>}
            </div>
          </div>
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg transform transition-all duration-300 hover:shadow-xl">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-700">ROI Dashboard</h2>
              <div className="mb-4 bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700">Simulation Results</h3>
                <p className="text-sm">Revenue: <span className="font-bold">${revenue.toFixed(2)}</span></p>
                <p className="text-sm">Cost: <span className="font-bold">${adCost.toFixed(2)}</span></p>
                <p className="text-sm">ROI: <span className="font-bold">{(roiData[0]?.roi * 100 || 0).toFixed(2)}%</span></p>
              </div>
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                      mode: 'index',
                      callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)}%`,
                      },
                    },
                  },
                  animation: { duration: 1000, easing: 'easeInOutQuad' },
                  scales: {
                    y: { title: { display: true, text: 'ROI (%)' } },
                    x: { title: { display: true, text: 'Time' } },
                  },
                }}
              />
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="font-semibold text-blue-800">Cultural Trend</p>
                  <GaugeChart
                    id="cultural-gauge"
                    nrOfLevels={20}
                    percent={factors.culturalTrend / 100}
                    arcWidth={0.3}
                    colors={['#ff6b6b', '#10b981']}
                    needleColor="#3b82f6"
                    textColor="#1f2937"
                  />
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="font-semibold text-green-800">Search Trends</p>
                  <GaugeChart
                    id="search-gauge"
                    nrOfLevels={20}
                    percent={factors.searchTrends / 100}
                    arcWidth={0.3}
                    colors={['#ff6b6b', '#10b981']}
                    needleColor="#3b82f6"
                    textColor="#1f2937"
                  />
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="font-semibold text-yellow-800">Population</p>
                  <p className="text-lg font-bold">{factors.population.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="font-semibold text-red-800">Competitor Influence</p>
                  <p className="text-lg font-bold">{factors.competitorCount} competitors</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="font-semibold text-purple-800">Policy Impact</p>
                  <GaugeChart
                    id="policy-gauge"
                    nrOfLevels={20}
                    percent={factors.policyImpact}
                    arcWidth={0.3}
                    colors={['#ff6b6b', '#10b981']}
                    needleColor="#3b82f6"
                    textColor="#1f2937"
                  />
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                  className="w-full bg-gray-200 text-gray-800 p-2 rounded-lg hover:bg-gray-300 transition-all duration-200"
                >
                  {isHistoryOpen ? 'Hide Update History' : 'Show Update History'}
                </button>
                {isHistoryOpen && (
                  <div className="mt-2 bg-gray-50 p-4 rounded-lg animate-fade-in">
                    <h3 className="font-semibold mb-2 text-gray-700">Update History (Last 5)</h3>
                    {updateHistory.map((update, index) => (
                      <div key={index} className="mb-2 border-l-2 border-blue-500 pl-2">
                        <p className="text-sm">[{update.timestamp}] ROI: {(update.roi * 100).toFixed(2)}%</p>
                        <p className="text-sm">Trends: {update.factors.culturalTrend}, Search: {update.factors.searchTrends}, Policy: {(update.factors.policyImpact * 100).toFixed(0)}%</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg transform transition-all duration-300 hover:shadow-xl">
              <button
                onClick={() => setIsAnalysisOpen(!isAnalysisOpen)}
                className="w-full bg-gray-200 text-gray-800 p-2 rounded-lg hover:bg-gray-300 transition-all duration-200"
              >
                {isAnalysisOpen ? 'Hide Analysis & Optimization' : 'Show Analysis & Optimization'}
              </button>
              {isAnalysisOpen && (
                <div className="mt-2 animate-fade-in">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-700">Analysis & Optimization</h2>
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-700">Factor Impact</h3>
                    <Bar
                      data={impactChartData}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context) => `${context.label}: ${context.parsed.y.toFixed(2)}%`,
                            },
                          },
                        },
                        scales: {
                          y: { title: { display: true, text: 'Importance (%)' } },
                          x: { title: { display: true, text: 'Factors' } },
                        },
                        animation: { duration: 1000, easing: 'easeInOutQuad' },
                      }}
                    />
                  </div>
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-700">Reasons for Performance</h3>
                    {analysis.length > 0 ? (
                      <ul className="list-disc pl-5 text-sm">
                        {analysis.map((item, index) => (
                          <li key={index} className="text-gray-600">{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600">No analysis available.</p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-700">Suggestions</h3>
                    {suggestions.length > 0 ? (
                      <ul className="list-disc pl-5 text-sm">
                        {suggestions.map((item, index) => (
                          <li key={index} className="text-gray-600">{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600">No suggestions available.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
      `}</style>
    </main>
  );
}