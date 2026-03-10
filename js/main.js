import * as render_jar from './jar_viz.js';
import * as phases from './phases_crashes.js';
import * as crash_vs_year from './crash_vs_year.js';
import * as weather_viz from './weather_viz.js';
import * as timeline from './timeline.js';
import * as causes from './causes.js';
import { render } from './primary-causes.js';
import * as airplaneHeatmap from './airplane_heatmap.js';

var svg_phases = d3.select("#phases-chart")
    .append("svg")
    .attr("width", 900)
    .attr("height", 500);

var svg_jar = d3.select("#jar-viz")
    .append("svg")
    .attr("width", 900)
    .attr("height", 900)
    .style("max-width", "100%")
    .attr("text-anchor", "middle");

var svg_airplane = d3.select("#airplane-heatmap")
    .append("svg")
    .attr("width", 700)
    .attr("height", 900)
    .style("max-width", "100%")
    .attr("text-anchor", "middle");

let svg_weather = d3.select("#weather-viz")
    .append("svg")
    .attr("width", 800)
    .attr("height", 350)
    .style("max-width", "100%")

    .style("display", "block")
    .style("margin", "-20px auto 0 auto");

// Data that has coordinates (same CSV as globe) — for timeline and causes
d3.csv("data/Plane_Crashes_with_Coordinates.csv").then(function(rows) {
    var timelineEl = d3.select("#timeline-viz");
    if (!timelineEl.empty()) timeline.renderTimeline(timelineEl, rows);
    var causesEl = d3.select("#causes-viz");
    if (!causesEl.empty()) causes.renderCauses(causesEl, rows);
}).catch(function(e) { console.error("Timeline/causes load error:", e); });

d3.csv("data/plane_crashes.csv").then(function(csv) {
    render_jar.render_jar(svg_jar, csv);
}).catch(function(e) { console.error("Jar viz load error:", e); });

d3.csv("data/plane_crashes.csv").then(csv => {
    const container = d3.select("#causes-chart");
    render(container, csv);
});

d3.csv("data/phase_crashes.csv").then(function(csv) {
    csv.forEach(function(d) { d.crashes = +d.crashes; });
    phases.render(svg_phases, csv);
});

d3.csv("data/weather_crashes.csv").then(csv => {
    weather_viz.render(svg_weather, csv);
}).catch(function(e) { console.error("Phases load error:", e); });

d3.csv("data/airplane_survivors.csv").then(function(csv) {
    airplaneHeatmap.render(svg_airplane, csv);
}).catch(function(e) { console.error("Airplane heatmap load error:", e); });
