# 🌌 RepoGazer 3.1: Visual Code Intelligence
> **"Stop reading code lines. Start gazing at your code galaxy."**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/mmporong/repogazer.svg?style=social)](https://github.com/mmporong/repogazer)

RepoGazer is a next-generation 3D codebase visualizer and architectural intelligence engine. It transforms your messy, complex repository into an interactive 3D universe, allowing you to trace bug impacts, identify technical debt, and see code ownership in a beautiful neon galaxy.

---

## 📸 Demo & Screenshots

![Main Galaxy View](https://via.placeholder.com/1200x600?text=RepoGazer+Galaxy+View+Placeholder)
*The 3D Neon Galaxy: Nodes represent functions, sized by complexity.*

![Blast Radius Simulation](https://via.placeholder.com/600x400?text=Blast+Radius+View) ![Debt Radar](https://via.placeholder.com/600x400?text=Debt+Radar+View)
*Left: Impact analysis of a code change. Right: Detecting God Objects and Dead Code.*

---

## 🚀 The 4 Pillars of Intelligence

### 🌌 1. Code Galaxy (Default)
Visualizes your entire project as a 3D constellation. Nodes are functions/methods, and edges are call relationships.
- **Neon Cluster Coloring:** Files are automatically grouped by unique neon palettes.
- **Dynamic Sizing:** Important "Hub" functions grow larger as more modules depend on them.

### 🔥 2. Git Blame Heatmap
Instantly see which parts of your code are "Hot" (frequently modified) vs "Cold" (stable/stale). 
- **Lava Nodes:** High churn areas prone to bugs.
- **Author Tracking:** Identify who owns which sector of the codebase.

### 💥 3. The Blast Radius (Impact Analysis)
Click any node to simulate a "Bug Explosion". RepoGazer will highlight every function that depends on that node, directly or indirectly. 

### 🔎 4. Tech Debt Radar
Detects architectural anomalies using gravitational algorithms.
- **God Objects (Black Holes):** Massive, tightly coupled functions.
- **Dead Code (Space Dust):** Isolated, unreachable code drifting at the edges.

---

## 🛠️ Quick Start

### 1. Backend: Analysis
Analyze your project and generate the data matrix.
```bash
# Clone and Install
git clone https://github.com/mmporong/repogazer.git
cd repogazer
npm install

# Parse any project (Unity C#, JS, TS)
node core/index.js <path_to_your_project>

# Copy data to web viewer
cp project_data.json web/public/
```

### 2. Frontend: Visualization
```bash
cd web
npm install
npm run dev
```
Open `http://localhost:5173` to explore your code.

---

## 🗺️ Roadmap
- [ ] **Git Time-Lapse:** Animate the evolution of your galaxy over time.
- [ ] **AI Refactor Suggestions:** Direct integration with Gemini/Claude for one-click fixes.
- [ ] **VR Support:** Walk through your galaxy in Meta Quest 3.

---
Developed with ❤️ by [mmporong](https://github.com/mmporong) 🌠
