import * as render_example from './render_example.js';

let svg = d3.select("#chart-area").append("svg").attr("id", "render_example");

render_example.render(svg);
