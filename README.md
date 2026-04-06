# Team Flight Risk — CSC316 Project
## https://csc316-project.github.io/Project/
A visual exploration of where, when, and why aviation incidents occur.

## File Overview
- index.html: HTML code
- css: CSS code
- js: JavaScript/D3.js code
- data: CSV data files
- images: PNG files

## Libraries
- Boostrap 5.3.3
- D3.js v7
- TopoJSON v3

## Questions This Project Explores
- How do accident rates change over time?
- Where do incidents cluster geographically?
- What factors (weather, mechanical failure, etc.) appear most often?
- What is the overall risk of flight travel?

AI was used for error handling and D3 best practices.

### Run the visualization locally

**Using Python HTTP server:**

```bash
python -m http.server 8000
```

Then open your browser and go to:

```
http://localhost:8000
```

**Note:** You cannot open `index.html` directly in the browser because of CORS restrictions when loading CSV files. Use a local server.

## Notes on Data
Aviation incident datasets can be incomplete, inconsistently reported, or biased toward certain regions/time periods. 
Visualizations in this project are meant to show **observed patterns in the available data**, not definitive conclusions about all aviation safety.

This CSC316 project is for educational purposes. The dataset is from Kaggle and subject to their terms of use.
