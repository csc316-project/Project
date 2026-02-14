const positions = [
    {x: 100, y: 400},
    {x: 210, y: 240},
    {x: 360, y: 180},
    {x: 510, y: 230},
    {x: 610, y: 300},
    {x: 710, y: 400}, // need to add more positions because there are 13 phases or i need to shorten the csv file
]

export function render(svg, data) {
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(data, d => d.crashes)])
        .range([0, 40]);

    const colorScale = d3.scaleSequential(d3.interpolatePurples)
        .domain([0, d3.max(data, d => d.crashes)]);

    const circles = svg.selectAll(".phase-circle")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "phase-circle")
        .attr("transform", (d, i) => {
            const pos = positions[i];
            if (!pos) return `translate(0,0)`;
            return `translate(${pos.x},${pos.y})`;
        });

    circles.append("circle")
        .attr("r", d => radiusScale(d.crashes))
        .attr("fill", d => colorScale(d.crashes))
        .attr("opacity", 0.7)
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

    circles.append("text")
        .text(d => d.flight_phase)
        .attr("text-anchor", "middle")
        .attr("dy", d => radiusScale(d.crashes) + 15)
        .style("fill", "#333");

    svg.append("image")
        .attr("xlink:href", "images/airplane.png")
        .attr("x", 40)
        .attr("y", 400);
}


