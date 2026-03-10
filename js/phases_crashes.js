
export function render(svg, data) {
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const margin = {top: 100, right: 80, bottom: 100, left: 80};
    const baseline = height - margin.bottom; // y coordinate for ground
    const peakHeight = height * 0.5; // highest point for the arch

    svg.selectAll("*").remove();
    const defs = svg.append("defs");

    d3.select(".d3-tooltip").remove();
    const tooltip = d3.select("body").append("div")
        .style("position", "absolute")
        .style("visibility", "hidden")
        .style("background", "rgba(20, 24, 35, 0.95)")
        .style("color", "#fff")
        .style("padding", "10px 15px")
        .style("border", "1px solid #555")
        .style("border-radius", "8px")
        .style("font-family", "sans-serif")
        .style("font-size", "14px")
        .style("box-shadow", "0 4px 15px rgba(0,0,0,0.5)")
        .style("pointer-events", "none")
        .style("z-index", "10");

    const cruiseIndex = data.findIndex(d => d.flight_phase.includes("Cruise"));

    const xScale = d3.scaleLinear()
       .domain([0, data.length - 1])
        .range([margin.left, width - margin.right]);

    const archScale = d3.scaleLinear()
       .domain([0, cruiseIndex, data.length - 1])
       .range([0, 1, 0])
       // .interpolate(d3.interpolateNumber);

    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(data, d => d.crashes)])
        .range([12, 65]);

    const colorScale = d3.scaleSequential(t => {
        // 1. Get the original Magma color (clamped to the 0.2 - 0.9 range as before)
        let color = d3.hsl(d3.interpolateMagma(0.2 + (t * 0.7)));

        // 2. Reduce saturation (make it "less neon")
        color.s *= 0.5;

        // 3. Boost lightness (ensure it's not too dark for a white background)
        color.l = Math.min(color.l + 0.2, 0.85);

        return color.toString();
    })
        .domain([d3.max(data, d => d.crashes), 0]);

    const getPoint = (i) => {
        const x = xScale(i);
        const y = baseline - (Math.sin(archScale(i) * Math.PI / 2) * peakHeight);
        return {x,y};
    }

    // flight path line
    const lineGenerator = d3.line()
        .x((d, i) => getPoint(i).x)
        .y((d, i) => getPoint(i).y)
        .curve(d3.curveCatmullRom.alpha(0.5));

    const path = svg.append("path")
        .datum(data)
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", "#333")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "8,4")
        .attr("opacity", 0.3)

    const totalLength = path.node().getTotalLength()

    path.attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength);

    // circle data points
    const circles = svg.selectAll(".phase-circle")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "phase-circle")
        .attr("transform", (d, i) => `translate(${getPoint(i).x}, ${getPoint(i).y})`)
        .on("mouseover", (event, d) => {
            const i = data.indexOf(d);
            const p = getPoint(i);

            d3.select(event.currentTarget)
                .transition().duration(200)
                .attr("transform", `translate(${p.x}, ${p.y}) scale(1.2)`);

            d3.select(event.currentTarget).select("circle")
                .attr("stroke", "#fff").attr("stroke-width", 4);

            let content = `<strong>Phase:</strong> ${d.flight_phase}<br/><strong>Crashes:</strong> ${d.crashes.toLocaleString()}`;
            if (d.flight_phase.includes("Takeoff")) content = `<strong>Did you know?</strong><br/>Takeoff is one of the 'Critical 11' minutes.`;
            if (d.flight_phase.includes("Landing")) content = `<strong>Did you know?</strong><br/>Most incidents occur during the final 8 minutes of landing.`;

            tooltip.style("visibility", "visible").html(content);
        })
        .on("mousemove", (event) => {
            tooltip.style("top", (event.pageY - 40) + "px")
            .style("left", (event.pageX + 15) + "px");
        })
        .on("mouseout", (event, d) => {
            const i = data.indexOf(d);
            const p = getPoint(i);

            d3.select(event.currentTarget)
                .transition().duration(200)
                .attr("transform", `translate(${p.x}, ${p.y}) scale(1)`);

            tooltip.style("visibility", "hidden");
        });

    circles.append("circle")
        .attr("r", d => radiusScale(d.crashes))
        .attr("fill", d => colorScale(d.crashes))
        .attr("opacity", 1)
        // .attr("stroke", "#383535")
        .attr("stroke-width", 2);

    circles.append("text")
        .text(d => d.flight_phase)
        .attr("text-anchor", "middle")
        .attr("dy", d => radiusScale(d.crashes) + 20)
        .style("fill", "rgb(56,53,53)")
        .style("font-size", "13px")
        .style("font-family", "sans-serif");

    const airplane = svg.append("image")
        .attr("xlink:href", "images/airplane.png")
        .attr("width", 40)
        .attr("height", 40)
        .attr("x", -20)
        .attr("y", -20)
        .attr("transform", `translate(${xScale(0)}, ${baseline})`);

    const crashLabels = circles.append("text")
        .attr("class", "crash-count")
        .text(d => d.crashes.toLocaleString())
        .attr("text-anchor", "middle")
        .attr("dy", 5) // Center it inside the circle
        .style("fill", "white")
        .style("font-weight", "bold")
        .style("font-size", "14px")
        .style("font-family", "sans-serif")
        .style("opacity", 0) // Hide initially
        .style("pointer-events", "none");

    const startFlight = () => {
        const lastIndex = data.length - 1;

        path.attr("stroke-dashoffset", totalLength)
            .transition()
            .duration(15000)
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0);

        crashLabels.style("opacity", 0)
            .style("text-shadow", "0px 0px 4px rgba(0,0,0,0.8)")
            .attr("transform", "scale(0)");

        airplane.transition()
            .duration(15000)
            .ease(d3.easeLinear)
            .attrTween("transform", function() {
                return function(t) {
                    const i = t * lastIndex;
                    const p = getPoint(i);

                    data.forEach((d, index) => {
                        if (Math.abs(i - index) < 0.1) {
                            d3.select(crashLabels.nodes()[index])
                                .transition()
                                .duration(400)
                                .style("opacity", 1)
                                .attr("transform", "scale(1)");
                        }
                    });

                    let angle = 0;
                    if (i > 0.2 && i < cruiseIndex - 0.2) {
                        angle = -15;
                    } else if (i > cruiseIndex + 0.2 && i < lastIndex - 0.2) {
                        angle = 15;
                    } else {
                        angle = 0;
                    }

                    return `translate(${p.x}, ${p.y - 40}) rotate(${angle})`;
                };
            });
    };

    // trigger animation
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                startFlight();
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    observer.observe(svg.node());
}


