// globe crashes heatmap

var width = 960, height = 600;
let currentYear = 2023;
let isPlaying = false;
let playInterval = null;
let crashesData = [], filteredCrashes = [];
let crashPoints = [];
let selectedCrashes = [];
let currentCrashIndex = 0;  // which one were showing
let autoRotateEnabled = true;
let autoRotateInterval = null;
let animationSpeed = 1.0;
let animationFrameId = null;
let pendingUpdate = false;

let clickStartTime = 0, clickStartPos = { x: 0, y: 0 };
let wasDragging = false;
const CLICK_THRESHOLD = 5;
const CLICK_DURATION = 200;  // ms, to long = drag

d3.select("#globe-container").select(".loading").remove();

var globeEl = d3.select("#globe-container");
const svg = globeEl.append("svg").attr("width", width).attr("height", height);
const canvas = globeEl.append("canvas").attr("width", width).attr("height", height);
const ctx = canvas.node().getContext("2d");

const projection = d3.geoOrthographic()
    .scale(300)
    .translate([width / 2, height / 2])
    .clipAngle(90);
const path = d3.geoPath().projection(projection);

let rotation = { x: 0, y: 0 };
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function loadCSV() {
    return d3.csv("data/Plane_Crashes_with_Coordinates.csv")
        .catch(function() { throw new Error("Could not load crash data."); });
}

Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
    loadCSV()
]).then(function (stuff) {
    var world = stuff[0], crashes = stuff[1];
    crashesData = crashes.map(function(d) {
        var lat = parseFloat(d.Latitude || d.latitude || d.Lat || d.lat);
        var lon = parseFloat(d.Longitude || d.longitude || d.Lon || d.lon || d.Lng || d.lng);
        var year = null;
        if (d.Date) {
            var dateStr = d.Date.trim();
            if (dateStr.indexOf('-') !== -1) year = parseInt(dateStr.split('-')[0], 10);
            else if (dateStr.indexOf('/') !== -1) year = parseInt(dateStr.split('/').pop(), 10);
        }
        return {
            lat: isNaN(lat) ? null : lat,
            lon: isNaN(lon) ? null : lon,
            year: isNaN(year) ? null : year,
            location: d["Crash location"] || d.Location || d.location || "Unknown",
            operator: d.Operator || d.operator || "Unknown",
            fatalities: parseInt(d["Total fatalities"] || d.Fatalities || d.fatalities || 0, 10) || 0,
            country: d.Country || d.country || "Unknown"
        };
    });
    crashesData = crashesData.filter(function(d) { return d.lat != null && d.lon != null && d.year != null; });

    drawGlobe(world);
    filterAndDrawCrashes();
    setupControls();
    setupDragInteraction();
    setupClickDetection();
    startAutoRotate();
}).catch(function (err) {
    console.error(err);
    d3.select("#globe-container").select(".loading").remove();
});

function drawGlobe(world) {
    var countries = topojson.feature(world, world.objects.countries).features;
    svg.append("g").selectAll("path").data(countries).enter().append("path")
        .attr("d", path).attr("fill", "#1a1a2e").attr("stroke", "#16213e").attr("stroke-width", 0.8);

    var g = d3.geoGraticule();
    svg.append("path").datum(g).attr("d", path).attr("fill", "none")
        .attr("stroke", "rgba(255, 255, 255, 0.15)").attr("stroke-width", 0.5).attr("opacity", 0.4);

    var r = projection.scale();
    svg.append("circle").attr("cx", width / 2).attr("cy", height / 2).attr("r", r)
        .attr("fill", "none").attr("stroke", "rgba(255, 255, 255, 0.4)").attr("stroke-width", 2).attr("opacity", 0.5);
    svg.append("circle").attr("cx", width / 2).attr("cy", height / 2).attr("r", r + 2)
        .attr("fill", "none").attr("stroke", "rgba(255, 255, 255, 0.1)").attr("stroke-width", 1).attr("opacity", 0.3);
}

function filterAndDrawCrashes() {
    filteredCrashes = crashesData.filter(function(d) { return d.year <= currentYear; });
    d3.select("#crash-count").text(filteredCrashes.length);
    ctx.clearRect(0, 0, width, height);

    var heatMapData = [];
    if (filteredCrashes.length > 500) {
        heatMapData = createHeatMapData(filteredCrashes);
        drawHeatMap(heatMapData);
    }
    drawCrashPoints(filteredCrashes);
    updateLegend(heatMapData);
}

function createHeatMapData(crashes) {
    var grid = {}, cellSize = 3, key;
    for (var i = 0; i < crashes.length; i++) {
        var c = crashes[i];
        var gx = Math.floor((c.lon + 180) / cellSize);
        var gy = Math.floor((c.lat + 90) / cellSize);
        key = gx + "," + gy;
        if (!grid[key]) {
            grid[key] = { lon: gx * cellSize - 180 + cellSize / 2, lat: gy * cellSize - 90 + cellSize / 2, count: 0, fatalities: 0 };
        }
        grid[key].count++;
        grid[key].fatalities += c.fatalities;
    }
    return Object.keys(grid).map(function(k) { return grid[k]; });
}

function drawHeatMap(heatMapData) {
    if (!heatMapData.length) return;
    var maxCount = d3.max(heatMapData, function(d) { return d.count; }) || 1;
    function col(t) {
        if (t < 0.25) return d3.rgb(0, Math.floor((t / 0.25) * 255), 128 + Math.floor((t / 0.25) * 127));
        if (t < 0.5) { var s = (t - 0.25) / 0.25; return d3.rgb(Math.floor(s * 255), 255, Math.floor((1 - s) * 255)); }
        if (t < 0.75) { var s2 = (t - 0.5) / 0.25; return d3.rgb(255, Math.floor((1 - s2 * 0.5) * 255), 0); }
        var s3 = (t - 0.75) / 0.25;
        return d3.rgb(255, Math.floor((0.5 - s3 * 0.5) * 255), 0);
    }
    var scale = projection.scale(), cx = width / 2, cy = height / 2, maxD = scale + 50;
    var cells = [];
    for (var i = 0; i < heatMapData.length; i++) {
        var cell = heatMapData[i];
        var xy = projection([cell.lon, cell.lat]);
        var x = xy[0], y = xy[1];
        if (x == null || y == null || isNaN(x) || isNaN(y)) continue;
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > maxD * maxD) continue;
        cells.push({ x: x, y: y, color: d3.rgb(col(cell.count / maxCount)), radius: Math.sqrt(cell.count / maxCount) * 50 });
    }
    for (var j = 0; j < cells.length; j++) {
        var c = cells[j];
        ctx.fillStyle = "rgba(" + c.color.r + "," + c.color.g + "," + c.color.b + ",0.7)";
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function drawCrashPoints(crashes) {
    crashPoints = [];
    var MAX_POINTS = 2000;
    var pointsToDraw = crashes;
    if (crashes.length > MAX_POINTS) {
        var sorted = crashes.slice().sort(function(a, b) { return b.fatalities - a.fatalities; });
        var nKeep = Math.floor(MAX_POINTS * 0.3);
        var highF = sorted.slice(0, nKeep);
        var rest = sorted.slice(nKeep);
        var step = Math.ceil(rest.length / (MAX_POINTS - nKeep));
        for (var i = 0; i < rest.length && highF.length < MAX_POINTS; i += step) highF.push(rest[i]);
        pointsToDraw = highF.slice(0, MAX_POINTS);
    }

    var scale = projection.scale(), half = width / 2, halfY = height / 2, maxR = scale + 50;
    for (var p = 0; p < pointsToDraw.length; p++) {
        var crash = pointsToDraw[p];
        var xy = projection([crash.lon, crash.lat]);
        var x = xy[0], y = xy[1];
        if (x == null || y == null || isNaN(x) || isNaN(y)) continue;
        if (Math.sqrt((x - half) * (x - half) + (y - halfY) * (y - halfY)) > maxR) continue;

        var ptSize = crash.fatalities > 0 ? Math.min(3, 1 + crash.fatalities / 100) : 1.5;
        crashPoints.push({ crash: crash, x: x, y: y, radius: ptSize });

        var sel = false;
        for (var s = 0; s < selectedCrashes.length; s++) {
            if (selectedCrashes[s].lat === crash.lat && selectedCrashes[s].lon === crash.lon && selectedCrashes[s].year === crash.year) { sel = true; break; }
        }
        if (sel) {
            ctx.fillStyle = "rgba(255, 200, 50, 0.9)";
            ctx.beginPath();
            ctx.arc(x, y, ptSize + 1, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 255, 255, 1)";
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.fillStyle = "rgba(255, 100, 100, 0.6)";
            ctx.beginPath();
            ctx.arc(x, y, ptSize, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
    }
}

function setupControls() {
    var yearSlider = d3.select("#year-slider");
    var yearDisplay = d3.select("#year-display");
    var playPauseBtn = d3.select("#play-pause");
    var resetBtn = d3.select("#reset");
    var autoRotateBtn = d3.select("#auto-rotate-btn");
    var speedSlider = d3.select("#speed-slider");
    var speedDisplay = d3.select("#speed-display");
    var years = [];
    crashesData.forEach(function(d) { if (d.year != null) years.push(d.year); });
    var minYear = d3.min(years), maxYear = d3.max(years);

    yearSlider
        .attr("min", minYear)
        .attr("max", maxYear)
        .attr("value", maxYear)
        .on("input", function () {
            currentYear = parseInt(this.value);
            yearDisplay.text(currentYear);
            if (!pendingUpdate) {
                filterAndDrawCrashes();
                updateGlobe();
            }
        });

    currentYear = maxYear;
    yearDisplay.text(currentYear);

    speedSlider
        .on("input", function () {
            animationSpeed = parseFloat(this.value);
            speedDisplay.text(animationSpeed.toFixed(1));

            if (isPlaying) {
                if (playInterval) {
                    clearInterval(playInterval);
                }
                startAnimation();
            }
        });

    speedDisplay.text(animationSpeed.toFixed(1));

    function startAnimation() {
        var intervalMs = Math.max(50, Math.floor(1000 / animationSpeed));
        playInterval = setInterval(function() {
            currentYear = parseInt(yearSlider.property("value"), 10);
            if (currentYear >= maxYear) currentYear = minYear; else currentYear++;
            yearSlider.property("value", currentYear);
            yearDisplay.text(currentYear);
            filterAndDrawCrashes();
            updateGlobe();
        }, intervalMs);
    }

    playPauseBtn.on("click", function () {
        isPlaying = !isPlaying;
        if (isPlaying) {
            playPauseBtn.text("Pause");
            startAnimation();
        } else {
            playPauseBtn.text("Play");
            if (playInterval) {
                clearInterval(playInterval);
                playInterval = null;
            }
        }
    });

    resetBtn.on("click", function () {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
        }
        isPlaying = false;
        playPauseBtn.text("Play");
        currentYear = minYear;
        yearSlider.property("value", currentYear);
        yearDisplay.text(currentYear);
        filterAndDrawCrashes();
        updateGlobe();
    });

    autoRotateBtn.on("click", function () {
        autoRotateEnabled = !autoRotateEnabled;
        if (autoRotateEnabled) {
            autoRotateBtn.text("Stop Auto-Rotate");
            startAutoRotate();
        } else {
            autoRotateBtn.text("Start Auto-Rotate");
            stopAutoRotate();
        }
    });
}

function startAutoRotate() {
    if (autoRotateInterval) clearInterval(autoRotateInterval);
    autoRotateInterval = setInterval(function() {
        if (!isDragging && autoRotateEnabled) { rotation.y += 0.2; updateGlobe(); }
    }, 50);
}

function stopAutoRotate() {
    if (autoRotateInterval) {
        clearInterval(autoRotateInterval);
        autoRotateInterval = null;
    }
}

function setupDragInteraction() {
    var touchStartDistance = 0, touchStartScale = projection.scale();
    var touchStartAngle = 0, touchStartCenter = { x: 0, y: 0 };

    function handleMouseDown(event) {
        if (autoRotateEnabled) return;
        event.preventDefault();
        event.stopPropagation();
        isDragging = true;
        previousMousePosition = { x: event.clientX, y: event.clientY };
        svg.style("cursor", "grabbing");
        canvas.style("cursor", "grabbing");
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
    }
    function handleMouseMove(event) {
        if (!isDragging || autoRotateEnabled) {
            if (!isDragging && !autoRotateEnabled) { svg.style("cursor", "grab"); canvas.style("cursor", "grab"); }
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        var curX = event.clientX, curY = event.clientY;
        rotation.y += (curX - previousMousePosition.x) * 0.5;
        rotation.x += (curY - previousMousePosition.y) * 0.5;
        rotation.x = Math.max(-90, Math.min(90, rotation.x));
        if (animationFrameId) return;
        animationFrameId = requestAnimationFrame(function() {
            projection.rotate([rotation.y, -rotation.x]);
            svg.selectAll("path").attr("d", path);
            ctx.clearRect(0, 0, width, height);
            if (filteredCrashes.length > 0) {
                if (filteredCrashes.length > 500) drawHeatMap(createHeatMapData(filteredCrashes));
                drawCrashPoints(filteredCrashes);
            }
            animationFrameId = null;
        });
        previousMousePosition = { x: curX, y: curY };
    }
    function handleMouseUp(event) {
        if (!isDragging) return;
        var dist = clickStartTime > 0 ? Math.sqrt(Math.pow(event.clientX - clickStartPos.x, 2) + Math.pow(event.clientY - clickStartPos.y, 2)) : 0;
        if (dist > CLICK_THRESHOLD) wasDragging = true;
        isDragging = false;
        svg.style("cursor", "grab");
        canvas.style("cursor", "grab");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
    }

    svg.on("mousedown.drag", handleMouseDown);
    canvas.on("mousedown.drag", handleMouseDown);
    d3.select("#globe-container").on("mousedown.drag", handleMouseDown);
    d3.select(document)
        .on("mousemove.globe", handleMouseMove)
        .on("mouseup.globe", handleMouseUp);

    function handleWheel(event) {
        if (autoRotateEnabled) return;
        event.preventDefault();
        event.stopPropagation();
        var z = event.deltaY > 0 ? 0.92 : 1.08;
        var s = Math.max(150, Math.min(600, projection.scale() * z));
        projection.scale(s);
        updateGlobe();
    }

    svg.on("wheel", handleWheel);
    canvas.on("wheel", handleWheel);

    function handleTouchStart(event) {
        if (autoRotateEnabled || !event.touches.length) return;
        if (event.touches.length === 1) {
            isDragging = true;
            previousMousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        } else if (event.touches.length === 2) {
            isDragging = false;
            var t1 = event.touches[0], t2 = event.touches[1];
            touchStartDistance = Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
            touchStartScale = projection.scale();
            touchStartAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
            touchStartCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
        }
    }
    function handleTouchMove(event) {
        if (autoRotateEnabled) return;
        event.preventDefault();
        if (event.touches.length === 1 && isDragging) {
            var dx = event.touches[0].clientX - previousMousePosition.x;
            var dy = event.touches[0].clientY - previousMousePosition.y;
            rotation.x += dy * 0.5;
            rotation.y += dx * 0.5;
            updateGlobe();
            previousMousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        } else if (event.touches.length === 2) {
            var t1 = event.touches[0], t2 = event.touches[1];
            var curDist = Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
            var curAngle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
            rotation.y += (curAngle - touchStartAngle) * 100;
            projection.scale(Math.max(100, Math.min(500, touchStartScale * (curDist / touchStartDistance))));
            var cx = (t1.clientX + t2.clientX) / 2, cy = (t1.clientY + t2.clientY) / 2;
            rotation.x += (cy - touchStartCenter.y) * 0.3;
            rotation.y += (cx - touchStartCenter.x) * 0.3;
            updateGlobe();
            touchStartAngle = curAngle;
            touchStartCenter = { x: cx, y: cy };
            touchStartDistance = curDist;
            touchStartScale = projection.scale();
        }
    }
    function handleTouchEnd(event) {
        isDragging = false;
        touchStartDistance = 0;
        touchStartAngle = 0;
    }

    svg.on("touchstart", handleTouchStart);
    svg.on("touchmove", handleTouchMove);
    svg.on("touchend", handleTouchEnd);

    canvas.on("touchstart", handleTouchStart);
    canvas.on("touchmove", handleTouchMove);
    canvas.on("touchend", handleTouchEnd);
}

function setupClickDetection() {
    var infoBox = d3.select("#crash-info-box");
    var infoContent = d3.select(".info-box-content");

    canvas.on("mousedown.clickdetect", function(event) {
        clickStartTime = Date.now();
        clickStartPos = { x: event.clientX, y: event.clientY };
        wasDragging = false;
    });
    d3.select(document).on("mousemove.clickdetect", function(event) {
        if (clickStartTime > 0 && isDragging) {
            var d = Math.sqrt(Math.pow(event.clientX - clickStartPos.x, 2) + Math.pow(event.clientY - clickStartPos.y, 2));
            if (d > CLICK_THRESHOLD) wasDragging = true;
        }
    });

    canvas.on("click", function(event) {
        if (isDragging) return;
        var clickDuration = clickStartTime > 0 ? Date.now() - clickStartTime : 0;
        var dragDistance = clickStartTime > 0 ? Math.sqrt(Math.pow(event.clientX - clickStartPos.x, 2) + Math.pow(event.clientY - clickStartPos.y, 2)) : 0;
        if (wasDragging || dragDistance > CLICK_THRESHOLD || (clickStartTime > 0 && clickDuration > CLICK_DURATION)) {
            clickStartTime = 0;
            wasDragging = false;
            return;
        }
        event.stopPropagation();
        event.preventDefault();
        var rect = canvas.node().getBoundingClientRect();
        var mouseX = event.clientX - rect.left, mouseY = event.clientY - rect.top;
        var closestPoint = null, minDist = Infinity;
        for (var i = 0; i < crashPoints.length; i++) {
            var pt = crashPoints[i];
            var dist = Math.sqrt((mouseX - pt.x) * (mouseX - pt.x) + (mouseY - pt.y) * (mouseY - pt.y));
            if (dist < 15 && dist < minDist) { minDist = dist; closestPoint = pt; }
        }
        if (closestPoint) {
            var clickedCrash = closestPoint.crash;
            selectedCrashes = [];
            for (var j = 0; j < filteredCrashes.length; j++) {
                var fc = filteredCrashes[j];
                if (fc.lat === clickedCrash.lat && fc.lon === clickedCrash.lon) selectedCrashes.push(fc);
            }
            selectedCrashes.sort(function(a, b) { return (b.fatalities || 0) - (a.fatalities || 0); });
            currentCrashIndex = 0;
            if (selectedCrashes.length > 0) {
                selectedCrash = selectedCrashes[0];
                showCrashInfo(selectedCrashes[0], infoBox, infoContent);
                filterAndDrawCrashes();
            }
        } else {
            selectedCrashes = [];
            currentCrashIndex = 0;
            selectedCrash = null;
            hideCrashInfo(infoBox, infoContent);
            filterAndDrawCrashes();
        }
        clickStartTime = 0;
        wasDragging = false;
    });

    svg.on("click", function(event) {
        if (wasDragging) return;
        var clickDuration = Date.now() - clickStartTime;
        var dragDistance = Math.sqrt(Math.pow(event.clientX - clickStartPos.x, 2) + Math.pow(event.clientY - clickStartPos.y, 2));
        if (dragDistance <= CLICK_THRESHOLD && clickDuration < CLICK_DURATION) {
            selectedCrashes = [];
            currentCrashIndex = 0;
            hideCrashInfo(infoBox, infoContent);
            filterAndDrawCrashes();
        }
    });

    canvas.on("mousemove", function(event) {
        if (isDragging) return;
        var rect = canvas.node().getBoundingClientRect();
        var mx = event.clientX - rect.left, my = event.clientY - rect.top;
        var near = false;
        for (var k = 0; k < crashPoints.length; k++) {
            var p = crashPoints[k];
            if (Math.sqrt((mx - p.x) * (mx - p.x) + (my - p.y) * (my - p.y)) < 15) { near = true; break; }
        }
        canvas.style("cursor", near ? "pointer" : "default");
    });
}

function showCrashInfo(crash, infoBox, infoContent) {
    var dateStr = crash.year ? String(crash.year) : "Unknown";
    var location = crash.location || "Unknown";
    var country = crash.country || "Unknown";
    var operator = crash.operator || "Unknown";
    var fatalities = crash.fatalities || 0;
    var hasPrevious = currentCrashIndex > 0;
    var hasNext = currentCrashIndex < selectedCrashes.length - 1;
    var totalCrashes = selectedCrashes.length;

    var infoHTML = `
        <div class="crash-details">
            <div class="crash-title">Plane Crash Details ${totalCrashes > 1 ? `(${currentCrashIndex + 1} of ${totalCrashes})` : ''}</div>
            ${totalCrashes > 1 ? `
            <div class="crash-navigation">
                <button id="prev-crash" class="nav-button" ${!hasPrevious ? 'disabled' : ''}>Previous</button>
                <span class="nav-info">${currentCrashIndex + 1} / ${totalCrashes}</span>
                <button id="next-crash" class="nav-button" ${!hasNext ? 'disabled' : ''}>Next</button>
            </div>
            ` : ''}
            <div class="crash-detail-item">
                <div class="crash-detail-label">Date</div>
                <div class="crash-detail-value">${dateStr}</div>
            </div>
            <div class="crash-detail-item">
                <div class="crash-detail-label">Location</div>
                <div class="crash-detail-value">${location}</div>
            </div>
            <div class="crash-detail-item">
                <div class="crash-detail-label">Country</div>
                <div class="crash-detail-value">${country}</div>
            </div>
            <div class="crash-detail-item">
                <div class="crash-detail-label">Operator</div>
                <div class="crash-detail-value">${operator}</div>
            </div>
            <div class="crash-detail-item">
                <div class="crash-detail-label">Fatalities</div>
                <div class="crash-detail-value ${fatalities > 0 ? 'highlight' : ''}">${fatalities.toLocaleString()}</div>
            </div>
        </div>
    `;

    infoContent.html(infoHTML);
    infoBox.classed("active", true);

    if (totalCrashes > 1) {
        d3.select("#prev-crash").on("click", null);
        d3.select("#next-crash").on("click", null);
        d3.select("#prev-crash").on("click", function(event) {
            event.stopPropagation();
            event.preventDefault();
            if (currentCrashIndex > 0) { currentCrashIndex--; showCrashInfo(selectedCrashes[currentCrashIndex], infoBox, infoContent); }
        });
        d3.select("#next-crash").on("click", function(event) {
            event.stopPropagation();
            event.preventDefault();
            if (currentCrashIndex < selectedCrashes.length - 1) { currentCrashIndex++; showCrashInfo(selectedCrashes[currentCrashIndex], infoBox, infoContent); }
        });
    }
}

function hideCrashInfo(infoBox, infoContent) {
    infoContent.html('<p class="info-placeholder">Click on a crash point to see details</p>');
    infoBox.classed("active", false);
}

function updateLegend(heatMapData) {
    if (!heatMapData.length) {
        d3.select("#legend-items").html('<div class="legend-item">No crashes to display</div>');
        return;
    }
    var maxCount = d3.max(heatMapData, function(d) { return d.count; }) || 1;
    function col(t) {
        if (t < 0.25) return d3.rgb(0, Math.floor((t / 0.25) * 255), 128 + Math.floor((t / 0.25) * 127));
        if (t < 0.5) { var s = (t - 0.25) / 0.25; return d3.rgb(Math.floor(s * 255), 255, Math.floor((1 - s) * 255)); }
        if (t < 0.75) { var s2 = (t - 0.5) / 0.25; return d3.rgb(255, Math.floor((1 - s2 * 0.5) * 255), 0); }
        var s3 = (t - 0.75) / 0.25;
        return d3.rgb(255, Math.floor((0.5 - s3 * 0.5) * 255), 0);
    }
    var gradientColors = [];
    for (var i = 0; i <= 20; i++) {
        var c = col(i / 20);
        gradientColors.push("rgb(" + c.r + "," + c.g + "," + c.b + ")");
    }
    var legendItems = [];
    for (var j = 0; j <= 5; j++) {
        var val = Math.floor((j / 5) * maxCount);
        var color = col(val / maxCount);
        legendItems.push('<div class="legend-item"><span class="legend-color" style="background:rgb(' + color.r + ',' + color.g + ',' + color.b + ');"></span><span>' + val + ' crash' + (val !== 1 ? 'es' : '') + '</span></div>');
    }
    d3.select("#legend-items").html(
        '<div class="legend-item" style="width: 100%; margin-bottom: 10px; justify-content: center;"><span class="legend-gradient" style="background: linear-gradient(to right, ' + gradientColors.join(", ") + ');"></span></div>' +
        legendItems.join("") +
        '<div class="legend-item" style="width: 100%; margin-top: 10px; font-size: 0.75em; opacity: 0.7; justify-content: center;">Max: ' + maxCount + ' crash' + (maxCount !== 1 ? 'es' : '') + ' per location</div>'
    );
}

function updateGlobe() {
    if (pendingUpdate) return;
    pendingUpdate = true;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(function() {
        projection.rotate([rotation.y, -rotation.x]);
        svg.selectAll("path").attr("d", path);
        if (filteredCrashes.length > 0) {
            filterAndDrawCrashes();
            if (selectedCrashes.length > 0) {
                var first = selectedCrashes[0];
                var newSel = [];
                for (var i = 0; i < filteredCrashes.length; i++) {
                    var fc = filteredCrashes[i];
                    if (fc.lat === first.lat && fc.lon === first.lon) newSel.push(fc);
                }
                newSel.sort(function(a, b) { return (b.fatalities || 0) - (a.fatalities || 0); });
                selectedCrashes = newSel;
                if (currentCrashIndex >= selectedCrashes.length) currentCrashIndex = Math.max(0, selectedCrashes.length - 1);
                if (selectedCrashes.length > 0) {
                    var infoBox = d3.select("#crash-info-box");
                    if (!infoBox.classed("active")) showCrashInfo(selectedCrashes[currentCrashIndex], infoBox, d3.select(".info-box-content"));
                } else {
                    selectedCrashes = [];
                    currentCrashIndex = 0;
                    hideCrashInfo(d3.select("#crash-info-box"), d3.select(".info-box-content"));
                }
            }
        } else {
            selectedCrashes = [];
            currentCrashIndex = 0;
            hideCrashInfo(d3.select("#crash-info-box"), d3.select(".info-box-content"));
        }
        pendingUpdate = false;
        animationFrameId = null;
    });
}

