export function render(svg, data) {
    // INCREASED LEFT MARGIN TO 200 TO PREVENT CUTOFF
    const margin = { top: 40, right: 80, bottom: 60, left: 200 },
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom;

    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Group data by Primary Weather
    const weatherCounts = d3.rollup(data, v => v.length, d => d["Primary Weather"]);
    // Convert to array of objects
    const groupedData = Array.from(weatherCounts, ([weather, count]) => ({ weather, count }));

    // Sort descending by count
    groupedData.sort((a, b) => d3.descending(a.count, b.count));

    // Scales
    const x = d3.scaleLinear()
        .domain([0, d3.max(groupedData, d => d.count) * 1.15])
        .range([0, width]);

    const y = d3.scaleBand()
        .domain(groupedData.map(d => d.weather))
        .range([0, height])
        .padding(0.4);

    // X Axis
    g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(6))
        .selectAll("text")
        .attr("fill", "rgba(255,255,255,0.92)")
        .style("font-size", "12px");

    // X Axis label
    g.append("text")
        .attr("x", width / 2)
        .attr("y", height + 45)
        .attr("text-anchor", "middle")
        .attr("fill", "rgba(255,255,255,0.7)")
        .text("Number of Crashes");

    // Y Axis Image Mappings
    const icons = {
        "Rain": "https://basmilius.github.io/weather-icons/production/fill/all/rain.svg",
        "Snow/Ice": "https://basmilius.github.io/weather-icons/production/fill/all/snow.svg",
        "Fog/Cloud": "https://basmilius.github.io/weather-icons/production/fill/all/fog.svg",
        "Storm/Wind": "https://basmilius.github.io/weather-icons/production/fill/all/thunderstorms-rain.svg"
    };

    // Draw the Y-axis baseline
    g.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", 0).attr("y2", height)
        .attr("stroke", "rgba(255,255,255,0.14)");

    // Setup tooltip
    let tooltip = d3.select("body").select(".viz-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div").attr("class", "viz-tooltip");
    }

    // Prepare lines (stick) but length 0 initially
    const lines = g.selectAll(".stick")
        .data(groupedData)
        .enter()
        .append("line")
        .attr("class", "stick")
        .attr("x1", 0)
        .attr("y1", d => y(d.weather) + y.bandwidth() / 2)
        .attr("x2", 0)
        .attr("y2", d => y(d.weather) + y.bandwidth() / 2)
        .attr("stroke", "var(--accent)")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "4 4");

    // Prepare planes hidden at x=0
    const planes = g.selectAll(".plane")
        .data(groupedData)
        .enter()
        .append("text")
        .attr("class", "plane")
        .attr("x", 0)
        .attr("y", d => y(d.weather) + y.bandwidth() / 2 + 8)
        .text("✈️")
        .style("font-size", "28px")
        .style("opacity", 0) // Hide initially until shot
        .style("cursor", "pointer")  // Re-enable pointer events for hover
        .on("mouseenter", function (event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .style("font-size", "40px")
                .attr("y", y(d.weather) + y.bandwidth() / 2 + 12);

            tooltip.transition().duration(200).style("display", "block").style("opacity", 1);
            tooltip.html(`Weather: <span style="color:var(--accent)">${d.weather}</span><br>Crashes: <strong style="font-size: 1.2em;">${d.count}</strong>`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 35) + "px");
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 35) + "px");
        })
        .on("mouseleave", function (event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .style("font-size", "28px")
                .attr("y", y(d.weather) + y.bandwidth() / 2 + 8);

            tooltip.transition().duration(500).style("opacity", 0).on("end", function () {
                tooltip.style("display", "none");
            });
        });

    const iconSize = 64;

    // Draw Weather Text Labels on Y axis
    g.selectAll(".weather-label")
        .data(groupedData)
        .enter()
        .append("text")
        .attr("class", "weather-label axis-label")
        .attr("x", -15) // Position to the right of the icon, left of the axis
        .attr("y", d => y(d.weather) + y.bandwidth() / 2 + 5)
        .attr("text-anchor", "end")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .style("pointer-events", "none") // Let hover pass through 
        .text(d => d.weather);

    // Draw Weather Images on Y axis area
    g.selectAll(".weather-icon")
        .data(groupedData)
        .enter()
        .append("image")
        .attr("class", "weather-icon")
        .attr("href", d => icons[d.weather])
        .attr("x", -iconSize - 100) // Move further left to make room for text label
        .attr("y", d => y(d.weather) + y.bandwidth() / 2 - iconSize / 2)
        .attr("width", iconSize)
        .attr("height", iconSize)
        .style("cursor", "crosshair")
        .on("mouseenter", function (event, d) {
            // Animate Icon scale slightly
            d3.select(this)
                .transition()
                .duration(200)
                .attr("width", iconSize * 1.2)
                .attr("height", iconSize * 1.2)
                .attr("x", -iconSize * 1.2 - 90)
                .attr("y", y(d.weather) + y.bandwidth() / 2 - (iconSize * 1.2) / 2);

            // Show Tooltip
            tooltip.transition().duration(200).style("display", "block").style("opacity", 1);
            tooltip.html(`Weather: <span style="color:var(--accent)">${d.weather}</span><br>Crashes: <strong style="font-size: 1.2em;">${d.count}</strong>`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 35) + "px");

            // Shoot Plane and Line
            const myLine = lines.filter(lineData => lineData.weather === d.weather);
            const myPlane = planes.filter(planeData => planeData.weather === d.weather);

            // Restart animation from 0
            myPlane.interrupt()
                .attr("x", 0).style("opacity", 1)
                .transition()
                .duration(900)
                .ease(d3.easeCubicOut)
                .attr("x", x(d.count));

            myLine.interrupt()
                .attr("x2", 0)
                .transition()
                .duration(900)
                .ease(d3.easeCubicOut)
                .attr("x2", x(d.count));
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 35) + "px");
        })
        .on("mouseleave", function (event, d) {
            // Reset Icon scale
            d3.select(this)
                .transition()
                .duration(200)
                .attr("width", iconSize)
                .attr("height", iconSize)
                .attr("x", -iconSize - 100)
                .attr("y", y(d.weather) + y.bandwidth() / 2 - iconSize / 2);

            // Hide Tooltip
            tooltip.transition().duration(500).style("opacity", 0).on("end", function () {
                tooltip.style("display", "none");
            });
        });

    // Style the axes paths and ticks for dark mode
    g.selectAll(".domain").attr("stroke", "rgba(255,255,255,0.14)");
    g.selectAll(".tick line").attr("stroke", "rgba(255,255,255,0.14)");
}
