import sys
import json
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder


sample_data = np.array([
    [1000, 50, 1000000, 60, 2, 0.8, 'informative', 2000],
    [1500, 70, 1500000, 80, 3, 0.9, 'persuasive', 3500],
    [500, 30, 500000, 40, 1, 0.7, 'emotive', 1200],
    [2000, 60, 1200000, 70, 2, 0.85, 'comparative', 2800],
    [800, 40, 800000, 50, 1, 0.9, 'reminder', 1600],
    [3000, 80, 2000000, 90, 4, 0.95, 'emotive', 5000],
])


le = LabelEncoder()
sample_data[:, 6] = le.fit_transform(sample_data[:, 6])

X = sample_data[:, :-1].astype(float)
y = sample_data[:, -1].astype(float)


X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)


feature_names = ['ad_cost', 'cultural_trend', 'population', 'search_trends', 'competitor_count', 'policy_impact', 'ad_approach']


if len(sys.argv) > 1:
    data = json.loads(sys.argv[1])
else:
    data = {
        "adCost": 1000,
        "factors": {
            "culturalTrend": 50,
            "population": 1000000,
            "searchTrends": 50,
            "competitorCount": 2,
            "policyImpact": 0.8
        },
        "adApproach": "informative"
    }

ad_cost = data['adCost']
factors = data['factors']
ad_approach = le.transform([data['adApproach']])[0]

input_features = np.array([[
    ad_cost,
    factors['culturalTrend'],
    factors['population'],
    factors['searchTrends'],
    factors['competitorCount'],
    factors['policyImpact'],
    ad_approach
]])
predicted_revenue = model.predict(input_features)[0]
roi = (predicted_revenue - ad_cost) / ad_cost if ad_cost != 0 else 0


importances = model.feature_importances_
feature_impact = {name: imp for name, imp in zip(feature_names, importances)}


analysis = []
suggestions = []
if roi < 0.1:
    top_factors = sorted(feature_impact.items(), key=lambda x: x[1], reverse=True)[:2]
    for factor, importance in top_factors:
        if factor == 'ad_cost' and importance > 0.2:
            analysis.append(f"High ad cost (${ad_cost:.2f}) is significantly reducing ROI.")
            suggestions.append("Reduce ad spend or switch to a lower-cost ad type (e.g., PPC).")
        elif factor == 'competitor_count' and importance > 0.2:
            analysis.append(f"High competition ({factors['competitorCount']} competitors) is impacting performance.")
            suggestions.append("Target a less competitive market or use comparative ads.")
        elif factor == 'search_trends' and importance > 0.2:
            analysis.append(f"Low search trends ({factors['searchTrends']}) indicate weak demand.")
            suggestions.append("Use emotive or persuasive ads to boost interest.")
        elif factor == 'cultural_trend' and importance > 0.2:
            analysis.append(f"Low cultural trends ({factors['culturalTrend']}) suggest poor market fit.")
            suggestions.append("Adjust product positioning or target a different region.")
        elif factor == 'policy_impact' and importance > 0.2:
            analysis.append(f"Unfavorable policies (score: {factors['policyImpact']:.2f}) are limiting ROI.")
            suggestions.append("Explore markets with more favorable regulations.")
else:
    analysis.append("ROI is positive. Performance is driven by balanced factors.")
    suggestions.append("Maintain current strategy or experiment with higher ad spend for scale.")

print(json.dumps({
    "roi": roi,
    "revenue": predicted_revenue,
    "cost": ad_cost,
    "featureImpact": feature_impact,
    "analysis": analysis,
    "suggestions": suggestions
}))