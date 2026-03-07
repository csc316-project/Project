import * as render_jar from './jar_viz.js';
import * as phases from './phases_crashes.js';
import * as crash_vs_year from './crash_vs_year.js';

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

let svg_crash_vs_year = d3.select("#crash-vs-year")
    .append("svg")
    .style("max-width", "100%")
    .attr("text-anchor", "middle");


d3.csv("data/plane_crashes.csv").then(csv => {
    const parseDate = d3.timeParse("%Y-%m-%d");

    csv.forEach(d => {
        let parsed = parseDate(d.Date);

        d.Date = parsed;
        d.year = parsed.getFullYear();
    })

    render_jar.render_jar(svg_jar, csv);
    crash_vs_year.render(svg_crash_vs_year, csv);
});

d3.csv("data/phase_crashes.csv").then(csv => {
    csv.forEach(d => {
        d.crashes = +d.crashes;
    })
    phases.render(svg_phases, csv);
});
