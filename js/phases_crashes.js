
export function render(svg, data) {
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const margin = 80;
    const baseline = height - margin; // y coordinate for ground
    const peakHeight = height * 0.6; // highest point for the arch

    const cruiseIndex = data.findIndex(d => d.flight_phase.includes("Cruise"));

    const xScale = d3.scaleLinear()
       .domain([0, data.length - 1])
        .range([margin, width - margin]);

    const archScale = d3.scaleLinear()
       .domain([0, cruiseIndex, data.length - 1])
       .range([0, 1, 0])
       .interpolate(d3.interpolateNumber);

    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(data, d => d.crashes)])
        .range([5, 45]);

    const colorScale = d3.scaleSequential(d3.interpolatePurples)
        .domain([0, d3.max(data, d => d.crashes)]);

    const circles = svg.selectAll(".phase-circle")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "phase-circle")
        .attr("transform", (d, i) => {
            const x = xScale(i)
            const y = baseline - (Math.sin(archScale(i) * Math.PI / 2) * peakHeight);
            return `translate(${x}, ${y})`;
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
        .attr("dy", d => radiusScale(d.crashes) + 20)
        .style("fill", "white");

    svg.append("image")
        .attr("xlink:href", "images/airplane.png")
        .attr("x", xScale(0) - 50)
        .attr("y", baseline - 50)
        .attr("width", 40)
        .attr("height", 40);
}


