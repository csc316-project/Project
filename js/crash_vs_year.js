let width = 900, height = 500;
let padding = 50;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function render(svg, data) {
    let div = d3.select(svg.node().parentNode);

    svg.attr("width", width).attr("height", height);

    const counts = d3.rollups(
        data,
        v => v.length,
        d => d.year
    );

    let yearScale = d3.scaleLog().domain(d3.extent(counts, d => d[0])).range([padding, width - padding]);
    let xAxis = d3.axisBottom().scale(yearScale).tickFormat(d3.format("d"));

    let crashScale = d3.scaleLinear().domain(d3.extent(counts, d => d[1])).range([height - padding, padding]);
    let yAxis = d3.axisLeft().scale(crashScale);

    const line = d3.line().x(d => yearScale(d[0])).y(d => crashScale(d[1]));

    const bisect = d3.bisector(d => d[0]);

    const hoverLine = svg.append("line")
        .attr("stroke", "red")
        .attr("stroke-dasharray", "4,4")
        .attr("y1", padding)
        .attr("y2", height - padding)
        .style("opacity", 0);

    const tooltip = div.append("div")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid black")
        .style("padding", "8px")
        .style("pointer-events", "none")
        .style("opacity", 0)
        .style("color", "black")
        .style("border-radius", "5px");

    let planePng = svg.append("image")
        .attr("href", "images/airplane-white.png")
        .style("width", "30px")
        .attr("x", 0)
        .attr("y", 0)
        .style("opacity", 0)

    svg.append("rect")
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .attr("x", padding / 2)
        .attr("y", padding / 2)
        .attr("width", width - padding)
        .attr("height", height - padding)
        .on("mousemove", function(event) {
            const [mx] = d3.pointer(event);

            const year = yearScale.invert(mx);
            let i = bisect.left(counts, year);

            const d0 = counts[i - 1];
            const d1 = counts[i];

            let d = d0 ?? d1;

            if (i > 0) {
                if (d1 && (year - d0[0] > d1[0] - year)) {
                    d = d1;
                }
            }

            const prev = counts[Math.max(0, i - 1)];
            const next = counts[Math.min(counts.length - 1, i + 1)];
            const angle = Math.atan2(
                crashScale(next[1]) - crashScale(prev[1]),
                yearScale(next[0]) - yearScale(prev[0])
            );


            const x = yearScale(d[0]);
            const y = crashScale(d[1]);

            hoverLine
                .attr("x1", x)
                .attr("x2", x)
                .style("opacity", 1);

            tooltip
                .style("opacity", 1)
                .html(`Year: ${d[0]}<br>Crashes: ${d[1]}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 20) + "px");

            planePng
                .style("opacity", 1)
                .attr("x", x - 15)
                .attr("y", y - 15)
                .transition()
                .duration(200)
                .ease(d3.easeCubicOut)
                .attrTween("transform", function() {
                    const currentTransform = this.getAttribute("transform") || "";
                    const match = currentTransform.match(/rotate\(([-\d.]+)/);
                    const currentAngle = clamp(match ? parseFloat(match[1]) : 0, -30, 30);
                    const targetAngle = clamp(angle * 180 / Math.PI - 20, -30, 30);

                    return t => `rotate(${clamp(currentAngle + (targetAngle - currentAngle) * t, -30, 30)}, ${x}, ${y})`;
                });

            // planePng.style("opacity", 1)
            //     .attr("x", x - 15)
            //     .attr("y", y - 15)
            //     .attr("transform", `rotate(${angle * 180 / Math.PI - 20}, ${x}, ${y})`);
        })

        .on("mouseout", function() {
            hoverLine.style("opacity", 0);
            tooltip.style("opacity", 0);
            planePng.style("opacity", 0);
        });

    svg.append("path")
        .datum(counts)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2)
        .attr("d", line);

    svg.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", "translate(0," + (height - padding) + ")")
        .call(xAxis)
        .append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", 35)
        .style("text-anchor", "middle")
        .text("Year");

    svg.append("g")
        .attr("class", "axis y-axis")
        .attr("transform", "translate(" + padding + ", 0)")
        .call(yAxis)
        .append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -40)
        .style("text-anchor", "middle")
        .text("Number of Crashes");
}