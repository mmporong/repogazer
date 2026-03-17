# 🌌 RepoGazer 3.0: The Ultimate Code Intelligence
> **"Stop reading code lines. Start gazing at your code galaxy."**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/mmporong/repogazer.svg?style=social)](https://github.com/mmporong/repogazer)

RepoGazer is a next-generation 3D codebase visualizer and architectural intelligence engine. It transforms your messy, complex repository into an interactive 3D universe, allowing you to trace bug impacts, identify technical debt, and see who owns which part of the galaxy.

---

## 🚀 The 4 Pillars of Intelligence

### 🌌 1. Code Galaxy (Default)
Visualizes your entire project as a 3D constellation. Nodes are functions/methods, and edges are call relationships. Size is determined by "Code Gravity" (Complexity + Usages).

### 🔥 2. Git Blame Heatmap
Instantly see which parts of your code are "Hot" (frequently modified) vs "Cold" (stable/stale). 
- **Lava Stars:** Recent churn hotspots.
- **Author Territory:** Identify code ownership at a glance.

### 💥 3. The Blast Radius (Impact Analysis)
Click any node to simulate a "Bug Explosion". RepoGazer will highlight every function that depends on that node, directly or indirectly. 
- **1st Degree Burn:** Primary callers (Immediate risk).
- **2nd Degree Burn:** Secondary callers (Hidden risk).

### 🔎 4. Tech Debt Radar
Detects architectural anomalies using gravitational algorithms.
- **God Objects (Black Holes):** Massive, tightly coupled functions that suck in the rest of the galaxy.
- **Dead Code (Space Dust):** Isolated, unreachable code drifting at the edges.

---

## 🛠️ Quick Start

### 1. Parser (Core)
Analyze your project and generate the data matrix.
```bash
# Clone and Install
git clone https://github.com/mmporong/repogazer.git
cd repogazer
npm install

# Parse any project (Unity, JS, TS)
node core/parser.js <path_to_your_project>
```

### 2. Galaxy Viewer (Web)
```bash
cd web
npm install
npm run dev
```
Open `http://localhost:5173` to explore your code.

---

## 🧩 Supported Ecosystems
- **Game Dev:** Unity (C#) - *Optimized for MonoBehaviour patterns.*
- **Web Dev:** JavaScript, TypeScript, React.
- **Infrastructure:** Node.js.

---

## 📊 Case Study: The "Archer" Project Galaxy
We tested RepoGazer 3.0 on a real-world Unity project (**Archer**). Here is what the intelligence engine discovered:

- **Mapped Stars:** 883 (Functions & Methods)
- **Gravitational Links:** 3,970 (Call Relationships)
- **Hotspots Detected:** 
    - `UIManager.Awake`: **High Churn Score (95)** - Heavily modified in the last 48 hours.
    - `GameManager.Awake`: **God Object Detected** (103 outbound connections) - Core central controller.
- **Blast Radius:** Modifying `ObjectPoolManager.GetArrow` impacts **12 directly dependent** methods and **45 indirectly linked** logic paths.

---

## 🗺️ Roadmap
- [ ] **Git Time-Lapse:** Animate the evolution of your galaxy over years.
- [ ] **AI Architect Integration:** DeepSeek/Claude API for real-time refactoring suggestions.
- [ ] **VR Support:** Walk through your code in Meta Quest 3.

## 🤝 Contributing
Join us in building the future of developer tools. If RepoGazer helped you understand a complex project, give us a ⭐!

---
Developed with ❤️ by [mmporong](https://github.com/mmporong)
