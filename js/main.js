import * as render_example from './render_example.js';

let svg = d3.select("#chart-area").append("svg").attr("id", "render_example");

d3.csv("data/plane_crashes.csv").then(csv => {
    render_example.render(svg, csv);
});


