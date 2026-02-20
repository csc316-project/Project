// Globe settings
const GLOBE_W = 960;
const GLOBE_H = 600;

class GlobeApp {
    constructor(targetID) {
        this.container = d3.select(targetID);
        
        // App State
        this.year = 2023;
        this.running = false;
        this.speed = 1.0;
        this.autoSpin = true;
        this.spin = { x: 0, y: 0 };
        
        // Selection
        this.selCrashes = [];
        this.selIndex = 0;
        
        // Input state
        this.dragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.lastMouse = { x: 0, y: 0 };
        this.clickTime = 0;

        // Data arrays
        this.raw = [];
        this.active = [];
        this.points = []; // clickable points

        // Timers
        this.loop = null;
        this.spinTimer = null;
        this.raf = null;

        this.init();
    }

    init() {
        this.container.select(".loading").remove();

        // 1. Setup Canvas & SVG layers
        this.svg = this.container.append("svg")
            .attr("width", GLOBE_W).attr("height", GLOBE_H);
        
        this.cvs = this.container.append("canvas")
            .attr("width", GLOBE_W).attr("height", GLOBE_H);
        this.ctx = this.cvs.node().getContext("2d");

        // 2. Setup Projection
        this.proj = d3.geoOrthographic()
            .scale(300)
            .translate([GLOBE_W/2, GLOBE_H/2])
            .clipAngle(90);
            
        this.path = d3.geoPath().projection(this.proj);

        // 3. Load Data
        Promise.all([
            d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
            d3.csv("data/Plane_Crashes_with_Coordinates.csv")
        ]).then(([world, csv]) => {
            this.parse(csv);
            this.drawWorld(world);
            this.update();
            this.bindUI();
            this.bindMouse();
            this.toggleSpin(true);
        }).catch(e => console.error("Load error:", e));
    }

    parse(rows) {
        // Manual loop is often faster than map/filter chains
        const clean = [];
        for (let i = 0; i < rows.length; i++) {
            let r = rows[i];
            let lat = parseFloat(r.Latitude || r.lat || 0);
            let lon = parseFloat(r.Longitude || r.lon || 0);
            
            // Handle messy dates
            let y = null;
            let dStr = (r.Date || "").trim();
            if (dStr.includes('-')) y = parseInt(dStr.split('-')[0]);
            else if (dStr.includes('/')) y = parseInt(dStr.split('/').pop());

            // Only keep valid rows
            if (!isNaN(lat) && !isNaN(lon) && y) {
                clean.push({
                    lat: lat,
                    lon: lon,
                    year: y,
                    loc: r["Crash location"] || r.Location || "Unknown",
                    op: r.Operator || "Unknown",
                    dead: parseInt(r["Total fatalities"] || r.Fatalities || 0) || 0,
                    country: r.Country || "Unknown"
                });
            }
        }
        this.raw = clean;
    }

    drawWorld(world) {
        let lands = topojson.feature(world, world.objects.countries).features;
        
        // Static map background
        this.svg.append("g").selectAll("path")
            .data(lands).enter().append("path")
            .attr("d", this.path)
            .attr("fill", "#1a1a2e")
            .attr("stroke", "#16213e")
            .attr("stroke-width", 0.8);
            
        // Grid lines
        this.svg.append("path")
            .datum(d3.geoGraticule())
            .attr("d", this.path)
            .attr("fill", "none")
            .attr("stroke", "rgba(255,255,255,0.15)")
            .attr("stroke-width", 0.5);
            
        // Atmospheric glow
        let r = this.proj.scale();
        this.svg.append("circle")
            .attr("cx", GLOBE_W/2).attr("cy", GLOBE_H/2).attr("r", r)
            .attr("fill", "none").attr("stroke", "rgba(255,255,255,0.4)")
            .attr("stroke-width", 2);
    }

    update() {
        this.active = this.raw.filter(x => x.year <= this.year);
        d3.select("#crash-count").text(this.active.length);
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, GLOBE_W, GLOBE_H);
        
        let heat = [];
        // Only show heatmap if there's a lot of data
        if (this.active.length > 500) {
            heat = this.calcHeatmap();
            this.drawHeat(heat);
        }
        
        this.drawPoints();
        this.drawLegend(heat);
    }

    calcHeatmap() {
        let grid = {};
        let sz = 3; // grid size
        
        for (let c of this.active) {
            let gx = Math.floor((c.lon + 180) / sz);
            let gy = Math.floor((c.lat + 90) / sz);
            let k = gx + "-" + gy;
            
            if (!grid[k]) {
                grid[k] = {
                    x: gx * sz - 180 + sz/2,
                    y: gy * sz - 90 + sz/2,
                    c: 0
                };
            }
            grid[k].c++;
        }
        return Object.values(grid);
    }

    drawHeat(grid) {
        if (!grid.length) return;
        let max = 0;
        grid.forEach(g => { if(g.c > max) max = g.c; });
        
        let center = [GLOBE_W/2, GLOBE_H/2];
        let lim = (this.proj.scale() + 50) ** 2;

        for (let g of grid) {
            let pos = this.proj([g.x, g.y]);
            if (!pos || isNaN(pos[0])) continue;
            
            // Check distance to center to clip back-face points
            let dist = (pos[0]-center[0])**2 + (pos[1]-center[1])**2;
            if (dist > lim) continue;
            
            let t = g.c / max;
            let rad = Math.sqrt(t) * 50;
            let col = this.heatColor(t);
            
            this.ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},0.7)`;
            this.ctx.beginPath();
            this.ctx.arc(pos[0], pos[1], rad, 0, 6.28);
            this.ctx.fill();
        }
    }

    heatColor(t) {
        // Hand-coded gradient (Blue -> Yellow -> Red)
        if (t < 0.25) return {r:0, g:Math.floor(t*4*255), b:128+Math.floor(t*4*127)};
        if (t < 0.5) return {r:Math.floor((t-0.25)*4*255), g:255, b:Math.floor((1-(t-0.25)*4)*255)};
        if (t < 0.75) return {r:255, g:Math.floor((1-(t-0.5)*4*0.5)*255), b:0};
        return {r:255, g:Math.floor((0.5-(t-0.75)*4*0.5)*255), b:0};
    }

    drawPoints() {
        this.points = [];
        let list = this.active;
        
        // Optimization: Limit points if too many
        if (list.length > 2000) {
            let sorted = [...list].sort((a,b) => b.dead - a.dead);
            // Keep top 600, sample the rest
            let top = sorted.slice(0, 600);
            let rem = sorted.slice(600);
            let step = Math.ceil(rem.length / 1400);
            for(let i=0; i<rem.length; i+=step) top.push(rem[i]);
            list = top;
        }

        let lim = this.proj.scale() + 50;
        let cx = GLOBE_W/2;
        let cy = GLOBE_H/2;

        for (let p of list) {
            let xy = this.proj([p.lon, p.lat]);
            if (!xy) continue;
            
            // Basic clipping
            if (Math.hypot(xy[0]-cx, xy[1]-cy) > lim) continue;

            let r = p.dead > 0 ? Math.min(3, 1 + p.dead/100) : 1.5;
            
            // Store for hit testing
            this.points.push({ data: p, x: xy[0], y: xy[1], r: r });

            // Check if selected
            let sel = this.selCrashes.some(s => s.lat === p.lat && s.lon === p.lon && s.year === p.year);
            
            this.ctx.beginPath();
            this.ctx.arc(xy[0], xy[1], sel ? r+2 : r, 0, 6.28);
            if (sel) {
                this.ctx.fillStyle = "rgba(255, 200, 50, 0.9)";
                this.ctx.fill();
                this.ctx.strokeStyle = "#fff";
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            } else {
                this.ctx.fillStyle = "rgba(255, 100, 100, 0.6)";
                this.ctx.fill();
                this.ctx.strokeStyle = "rgba(255,255,255,0.9)";
                this.ctx.lineWidth = 0.5;
                this.ctx.stroke();
            }
        }
    }

    drawLegend(heat) {
        let leg = d3.select("#legend-items");
        if (!heat.length) {
            leg.html('<div class="legend-item">No crashes</div>');
            return;
        }
        
        let max = 0;
        heat.forEach(h => max = Math.max(max, h.c));
        
        // Simple HTML string construction
        let html = '<div style="display:flex; height:10px; background:linear-gradient(90deg, blue, cyan, yellow, orange, red); width:100%; margin-bottom:5px;"></div>';
        html += `<div style="text-align:center; font-size:12px; opacity:0.8;">Max density: ${max}</div>`;
        leg.html(html);
    }

    // --- Inputs & Controls ---

    bindUI() {
        let slider = d3.select("#year-slider");
        let disp = d3.select("#year-display");
        
        // Calculate min/max years
        let ys = this.raw.map(d => d.year).filter(y => y);
        let min = Math.min(...ys);
        let max = Math.max(...ys);
        
        slider.attr("min", min).attr("max", max).attr("value", max)
            .on("input", (e) => {
                this.year = +e.target.value;
                disp.text(this.year);
                if(!this.raf) this.doFrame();
            });
            
        this.year = max;
        disp.text(max);
        
        // Play button logic
        d3.select("#play-pause").on("click", function() {
            let self = d3.select(this);
            // using global access for simplicity
            let app = window.vizApp; 
            app.running = !app.running;
            
            if(app.running) {
                self.text("Pause");
                app.loop = setInterval(() => {
                    app.year = app.year >= max ? min : app.year + 1;
                    slider.property("value", app.year);
                    disp.text(app.year);
                    app.doFrame();
                }, 1000 / app.speed);
            } else {
                self.text("Play");
                clearInterval(app.loop);
            }
        });

        d3.select("#speed-slider").on("input", function() {
            window.vizApp.speed = +this.value;
            d3.select("#speed-display").text(window.vizApp.speed.toFixed(1));
        });

        d3.select("#reset").on("click", () => {
            let app = window.vizApp;
            app.running = false;
            clearInterval(app.loop);
            d3.select("#play-pause").text("Play");
            app.year = min;
            slider.property("value", min);
            disp.text(min);
            app.doFrame();
        });

        d3.select("#auto-rotate-btn").on("click", function() {
            let app = window.vizApp;
            app.autoSpin = !app.autoSpin;
            d3.select(this).text(app.autoSpin ? "Stop Auto-Rotate" : "Start Auto-Rotate");
            if(app.autoSpin) app.toggleSpin(true);
            else app.toggleSpin(false);
        });
    }

    toggleSpin(on) {
        if(this.spinTimer) clearInterval(this.spinTimer);
        if(on) {
            this.spinTimer = setInterval(() => {
                if(!this.dragging && this.autoSpin) {
                    this.spin.y += 0.2;
                    this.doFrame();
                }
            }, 50);
        }
    }

    doFrame() {
        if(this.raf) return;
        this.raf = requestAnimationFrame(() => {
            this.proj.rotate([this.spin.y, -this.spin.x]);
            this.svg.selectAll("path").attr("d", this.path);
            this.update();
            this.raf = null;
        });
    }

    // --- Interaction ---

    bindMouse() {
        let el = this.cvs.node();
        
        // Mouse Down
        const down = (e) => {
            if(this.autoSpin) return;
            e.preventDefault();
            this.dragging = true;
            let x = e.clientX || (e.touches && e.touches[0].clientX);
            let y = e.clientY || (e.touches && e.touches[0].clientY);
            this.lastMouse = {x, y};
            this.dragStart = {x, y};
            this.clickTime = Date.now();
            el.style.cursor = "grabbing";
        };

        // Mouse Move
        const move = (e) => {
            if(this.autoSpin) return;
            
            // Hover check
            if(!this.dragging) {
                let r = el.getBoundingClientRect();
                let mx = e.clientX - r.left;
                let my = e.clientY - r.top;
                let hit = this.points.find(p => Math.hypot(mx-p.x, my-p.y) < 10);
                el.style.cursor = hit ? "pointer" : "default";
                return;
            }
            
            e.preventDefault();
            let x = e.clientX || (e.touches && e.touches[0].clientX);
            let y = e.clientY || (e.touches && e.touches[0].clientY);
            
            let dx = x - this.lastMouse.x;
            let dy = y - this.lastMouse.y;
            
            this.spin.y += dx * 0.5;
            this.spin.x = Math.max(-90, Math.min(90, this.spin.x + dy*0.5));
            
            this.lastMouse = {x, y};
            this.doFrame();
        };

        // Mouse Up
        const up = (e) => {
            if(!this.dragging) return;
            this.dragging = false;
            el.style.cursor = "default";
            
            let x = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
            let y = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
            let dist = Math.hypot(x - this.dragStart.x, y - this.dragStart.y);
            
            // If it was a short click without much movement
            if(dist < 5 && (Date.now() - this.clickTime) < 300) {
                this.onClick(e);
            }
        };

        // Zoom
        const wheel = (e) => {
            if(this.autoSpin) return;
            e.preventDefault();
            let s = this.proj.scale();
            s = e.deltaY > 0 ? s * 0.9 : s * 1.1;
            if(s < 150) s = 150;
            if(s > 600) s = 600;
            this.proj.scale(s);
            this.doFrame();
        };

        d3.select(el)
            .on("mousedown", down)
            .on("touchstart", down)
            .on("wheel", wheel);
            
        d3.select(window)
            .on("mousemove", move)
            .on("touchmove", move)
            .on("mouseup", up)
            .on("touchend", up);
            
        d3.select("#prev-crash").on("click", () => this.nav(-1));
        d3.select("#next-crash").on("click", () => this.nav(1));
    }

    onClick(e) {
        let rect = this.cvs.node().getBoundingClientRect();
        let cx = (e.clientX || e.changedTouches[0].clientX) - rect.left;
        let cy = (e.clientY || e.changedTouches[0].clientY) - rect.top;
        
        let best = null;
        let minDist = 15;
        
        // Find closest point
        for(let p of this.points) {
            let d = Math.hypot(cx - p.x, cy - p.y);
            if(d < minDist) {
                minDist = d;
                best = p;
            }
        }
        
        if(best) {
            // Find all crashes at this location
            this.selCrashes = this.active.filter(a => 
                a.lat === best.data.lat && a.lon === best.data.lon
            ).sort((a,b) => b.dead - a.dead);
            this.selIndex = 0;
            this.showInfo();
        } else {
            this.selCrashes = [];
            d3.select("#crash-info-box").classed("active", false);
        }
        this.render();
    }

    nav(dir) {
        let n = this.selCrashes.length;
        if(n < 2) return;
        this.selIndex += dir;
        if(this.selIndex < 0) this.selIndex = 0;
        if(this.selIndex >= n) this.selIndex = n-1;
        this.showInfo();
    }

    showInfo() {
        let c = this.selCrashes[this.selIndex];
        let box = d3.select("#crash-info-box");
        let content = box.select(".info-box-content");
        
        box.classed("active", true);
        
        let html = `
            <div class="crash-details">
                <div class="crash-title">Crash ${this.selIndex+1} of ${this.selCrashes.length}</div>
                <div class="crash-detail-item"><b>Date:</b> ${c.year}</div>
                <div class="crash-detail-item"><b>Loc:</b> ${c.loc}</div>
                <div class="crash-detail-item"><b>Op:</b> ${c.op}</div>
                <div class="crash-detail-item"><b>Fatalities:</b> ${c.dead}</div>
            </div>`;
        content.html(html);
    }
}

// Global init for debugging
window.vizApp = new GlobeApp("#globe-container");