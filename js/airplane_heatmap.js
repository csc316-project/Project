// Font Awesome Airplane Icon (plane-up)
// License: CC BY 4.0 (https://fontawesome.com/license/free)
// Source: https://fontawesome.com/icons/plane-up
const AIRPLANE_PATH = "M482.3 192c34.2 0 93.7 29 93.7 64c0 36-59.5 64-93.7 64l-116.6 0L265.2 495.9c-5.7 10-16.3 16.1-27.8 16.1l-56.2 0c-10.6 0-18.3-10.2-15.4-20.4l49-171.6L112 320 68.8 377.6c-3 4-7.8 6.4-12.8 6.4l-42 0c-7.8 0-14-6.3-14-14c0-1.3 .2-2.6 .5-3.9L32 256 .5 145.9c-.4-1.3-.5-2.6-.5-3.9c0-7.8 6.3-14 14-14l42 0c5 0 9.8 2.4 12.8 6.4L112 192l102.9 0-49-171.6C162.9 10.2 170.6 0 181.2 0l56.2 0c11.5 0 22.1 6.2 27.8 16.1L365.7 192l116.6 0z";

export function render(svg, data) {
    console.log(`SVG id: ${svg.attr('id')}`);
    console.log(`Data rows: ${data.length}`);
    
    const containerHeight = 900;
    const containerWidth = 700;
    const planeCenterX = 350;

    svg.selectAll("*").remove();

    svg.attr("width", containerWidth)
       .attr("height", containerHeight)
       .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
       .attr("preserveAspectRatio", "xMidYMid meet");

    let tooltip = d3.select("body").select(".airplane-tooltip-simple");
    if (tooltip.empty()) {
        tooltip = d3.select("body")
            .append("div")
            .attr("class", "airplane-tooltip-simple")
            .style("position", "absolute")
            .style("background", "linear-gradient(135deg, rgba(28, 25, 22, 0.98), rgba(42, 38, 34, 0.98))")
            .style("color", "#fdfcfa")
            .style("padding", "14px 18px")
            .style("border-radius", "10px")
            .style("font-size", "14px")
            .style("pointer-events", "none")
            .style("opacity", "0")
            .style("z-index", "10000")
            .style("border", "2px solid rgba(196, 92, 38, 0.4)")
            .style("box-shadow", "0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset")
            .style("transition", "opacity 0.2s ease")
            .style("backdrop-filter", "blur(10px)");
    }

    const mainGroup = svg.append("g");

    const sections = [
        { 
            section: "Cockpit", 
            survivors: parseInt(data[0].Survivors),
            y: 50,
            height: 130
        },
        { 
            section: "Front jump seats", 
            survivors: parseInt(data[1].Survivors),
            y: 180,
            height: 140
        },
        { 
            section: "Front section", 
            survivors: parseInt(data[2].Survivors),
            y: 320,
            height: 140
        },
        { 
            section: "Middle section", 
            survivors: parseInt(data[3].Survivors),
            y: 460,
            height: 140
        },
        { 
            section: "Rear section", 
            survivors: parseInt(data[4].Survivors),
            y: 600,
            height: 140
        },
        { 
            section: "Rear jump seats", 
            survivors: parseInt(data[5].Survivors),
            y: 740,
            height: 75
        }
    ];

    const totalSurvivors = sections.reduce((sum, d) => sum + d.survivors, 0);
    const maxSurvivors = Math.max(...sections.map(d => d.survivors));
    
    sections.forEach(d => {
        d.fatalityScore = 1 - (d.survivors / maxSurvivors);
        d.survivorPercentage = ((d.survivors / totalSurvivors) * 100).toFixed(1);
        d.dangerLevel = d.fatalityScore < 0.3 ? 'Low' : d.fatalityScore < 0.6 ? 'Moderate' : 'High';
    });

    // Color scale from safe (yellow) to dangerous (dark red)
    const colorScale = d3.scaleSequential()
        .domain([0, 1])
        .interpolator(t => d3.interpolateRgb("#FFEB3B", "#B71C1C")(t));

    const defsGroup = mainGroup.append("defs");
    const maskDef = defsGroup.append("mask")
        .attr("id", `airplane-mask-${Math.random().toString(36).substr(2, 9)}`)
        .attr("maskUnits", "userSpaceOnUse")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", containerWidth)
        .attr("height", containerHeight);

    const planeScale = 1.4;
    const planeOffsetX = containerWidth / 2;
    const planeOffsetY = containerHeight / 2 + 30;
    
    maskDef.append("path")
        .attr("fill", "white")
        .attr("d", AIRPLANE_PATH)
        .attr("transform", `translate(${planeOffsetX}, ${planeOffsetY}) rotate(-90) scale(${planeScale}) translate(-288, -256)`);
    
    const maskId = maskDef.attr("id");

    const maskedGroup = mainGroup.append("g")
        .attr("mask", `url(#${maskId})`);

    sections.forEach((section, i) => {
        const sectionColor = colorScale(section.fatalityScore);
        
        maskedGroup.append("rect")
            .attr("x", 0)
            .attr("y", section.y)
            .attr("width", containerWidth)
            .attr("height", section.height)
            .attr("fill", sectionColor);
    });

    const labelGroup = mainGroup.append("g");

    sections.forEach((section, i) => {
        const labelY = section.y + section.height / 2;
        
        const sectionGroup = labelGroup.append("g")
            .attr("class", "zone-interactive")
            .style("cursor", "pointer");
        
        // Invisible rect for easier hovering
        sectionGroup.append("rect")
            .attr("x", planeCenterX - 100)
            .attr("y", section.y)
            .attr("width", 200)
            .attr("height", section.height)
            .attr("fill", "transparent")
            .on("mouseover", function(event) {
                tooltip
                    .html(
                        `<div style="font-size: 16px; font-weight: 700; color: #c45c26; margin-bottom: 10px; border-bottom: 1px solid rgba(196, 92, 38, 0.3); padding-bottom: 6px;">${section.section}</div>` +
                        `<div style="margin: 6px 0; line-height: 1.6;"><span style="color: #d4cfc4;">Survivors:</span> <strong style="color: #fdfcfa;">${section.survivors}</strong> <span style="color: #8a8376; font-size: 12px;">/ 44 total</span></div>` +
                        `<div style="margin: 6px 0; line-height: 1.6;"><span style="color: #d4cfc4;">Share:</span> <strong style="color: #fdfcfa;">${section.survivorPercentage}%</strong></div>` +
                        `<div style="margin: 6px 0; line-height: 1.6;"><span style="color: #d4cfc4;">Risk Level:</span> <strong style="color: ${section.dangerLevel === 'High' ? '#d32f2f' : section.dangerLevel === 'Moderate' ? '#f57c00' : '#7cb342'};">${section.dangerLevel}</strong></div>`
                    )
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 40) + "px")
                    .style("opacity", "1");
                
                sectionGroup.selectAll("text")
                    .transition()
                    .duration(200)
                    .style("fill", "#7dd3fc")
                    .style("filter", "drop-shadow(0 0 8px rgba(125, 211, 252, 0.9)) drop-shadow(0 0 16px rgba(125, 211, 252, 0.6)) drop-shadow(0 0 24px rgba(125, 211, 252, 0.4))");
            })
            .on("mousemove", function(event) {
                tooltip
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 30) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("opacity", "0");
                
                sectionGroup.selectAll("text")
                    .transition()
                    .duration(200)
                    .style("fill", "white")
                    .style("filter", "none");
            });
        
        sectionGroup.append("text")
            .attr("class", "section-label")
            .attr("x", planeCenterX)
            .attr("y", labelY - 6)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("fill", "white")
            .style("font-size", "17px")
            .style("font-weight", "bold")
            .style("text-shadow", "0px 0px 8px rgba(0,0,0,1)")
            .style("pointer-events", "none")
            .text(section.section);
        
        sectionGroup.append("text")
            .attr("class", "survivor-count")
            .attr("x", planeCenterX)
            .attr("y", labelY + 10)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("fill", "white")
            .style("font-size", "18px")
            .style("font-weight", "bold")
            .style("text-shadow", "0px 0px 10px rgba(0,0,0,1)")
            .style("pointer-events", "none")
            .text(`${section.survivors} survivors`);
    });
    
    const legendContainer = d3.select(svg.node().parentNode)
        .append("div")
        .style("margin-top", "-60px")
        .style("text-align", "center");
    
    const legendTitle = legendContainer.append("div")
        .style("font-size", "0.85em")
        .style("font-weight", "600")
        .style("color", "var(--muted)")
        .style("margin-bottom", "10px")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "0.08em")
        .text("Fatality Risk by Zone");
    
    const legendItems = legendContainer.append("div")
        .style("display", "flex")
        .style("justify-content", "center")
        .style("align-items", "center")
        .style("gap", "10px");
    
    legendItems.append("span")
        .style("font-size", "0.8em")
        .style("color", "var(--muted)")
        .text("Low Risk");
    
    const gradientSvg = legendItems.append("svg")
        .attr("width", 200)
        .attr("height", 20)
        .style("border-radius", "4px")
        .style("border", "1px solid var(--line)");
    
    const defs = gradientSvg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "airplane-legend-gradient")
        .attr("x1", "0%")
        .attr("x2", "100%");
    
    const stops = d3.range(0, 1.01, 0.1);
    stops.forEach(t => {
        gradient.append("stop")
            .attr("offset", (t * 100) + "%")
            .attr("stop-color", colorScale(t));
    });
    
    gradientSvg.append("rect")
        .attr("width", 200)
        .attr("height", 20)
        .style("fill", "url(#airplane-legend-gradient)");
    
    legendItems.append("span")
        .style("font-size", "0.8em")
        .style("color", "var(--muted)")
        .text("High Risk");
}
