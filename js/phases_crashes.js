
export function render(svg, data) {
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const margin = 80;
    const baseline = height - margin; // y coordinate for ground
    const peakHeight = height * 0.6; // highest point for the arch

    svg.selectAll("*").remove();

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

    // flight path line
    const lineGenerator = d3.line()
        .x((d, i) => xScale(i))
        .y((d, i) => baseline - (Math.sin(archScale(i) * Math.PI / 2) * peakHeight))
        .curve(d3.curveCatmullRom.alpha(0.5));

    svg.append("path")
        .datum(data)
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "8,4")
        .attr("opacity", 0.3);

    // circle data points
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
        .attr("opacity", 1)
        .attr("stroke", "#333")
        .attr("stroke-width", 2);

    circles.append("text")
        .text(d => d.flight_phase)
        .attr("text-anchor", "middle")
        .attr("dy", d => radiusScale(d.crashes) + 20)
        .style("fill", "white");

    const airplane = svg.append("image")
        .attr("xlink:href", "images/airplane.png")
        .attr("width", 40)
        .attr("height", 40)
        .attr("x", -20)
        .attr("y", -20)
        .style("filter", "brightness(0) invert(1)")
        .attr("transform", `translate(${xScale(0)}, ${baseline})`);

    const startFlight = () => {
        airplane.transition()
            .duration(15000)
            .ease(d3.easeQuadInOut)
            .attrTween("transform", function() {
                return function(t) {
                    const i = t * (data.length - 1);
                    const x = xScale(i);
                    const y = baseline - (Math.sin(archScale(i) * Math.PI / 2) * peakHeight);

                    const angle = i < cruiseIndex ? -15 : (i > cruiseIndex + 0.5 ? 15 : 0);

                    return `translate(${x}, ${y}) rotate(${angle})`;
                };
            });
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                startFlight();
                observer.unobserve(entry.target); // Play only once
            }
        });
    }, { threshold: 0.5 }); // Starts when 50% of the SVG is visible

    observer.observe(svg.node());
}


