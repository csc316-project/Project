import * as phases from './phases_crashes.js';

let svg_phases = d3.select("#phases-chart")
    .append("svg")
    .attr("width", 900)
    .attr("height", 500);

d3.csv("data/phase_crashes.csv").then(csv => {
    csv.forEach(d => {
        d.crashes = +d.crashes;
    })
    phases.render(svg_phases, csv);
});


