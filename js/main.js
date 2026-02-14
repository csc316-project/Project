import * as render_jar from './jar_viz.js';
import * as phases from './phases_crashes.js';
  
let svg_phases = d3.select("#phases-chart")
    .append("svg")
    .attr("width", 900)
    .attr("height", 500);

let svg_jar = d3.select("#jar-viz")
  .append("svg")
    .attr("width", 900)
    .attr("height", 900)
    .style("max-width", "100%")
    .attr("text-anchor", "middle");

d3.csv("data/plane_crashes.csv").then(csv => {
    render_jar.render_jar(svg_jar, csv);
});
  
d3.csv("data/phase_crashes.csv").then(csv => {
    csv.forEach(d => {
        d.crashes = +d.crashes;
    })
    phases.render(svg_phases, csv);
});
