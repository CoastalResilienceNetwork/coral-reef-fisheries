require({
    // Specify library locations.
    packages: [
        {
            name: "jquery",
            location: "//ajax.googleapis.com/ajax/libs/jquery/1.9.0",
            main: "jquery.min"
        },
        {
            name: "underscore",
            location: "//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.8.3",
            main: "underscore-min"
        },
        {
            name: "d3",
            location: "//d3js.org",
            main: "d3.v3.min"
        }
    ]
});

define([
    "dojo/_base/declare",
    "d3",
    "framework/PluginBase",
    "esri/layers/ArcGISDynamicMapServiceLayer",
    "esri/layers/LayerDrawingOptions",
    "esri/renderers/ClassBreaksRenderer",
    "esri/symbols/SimpleLineSymbol",
    "esri/renderer",
    "esri/Color",
    "dojo/text!./template.html",
    "dojo/text!./layers.json",
    "dojo/text!./data.json",
    "dojo/text!./country-config.json"
    ], function (declare,
              d3,
              PluginBase,
              ArcGISDynamicMapServiceLayer,
              LayerDrawingOptions,
              ClassBreaksRenderer,
              SimpleLineSymbol,
              Renderer,
              Color,
              templates,
              layerSourcesJson,
              Data,
              CountryConfig
              ) {
        return declare(PluginBase, {
            toolbarName: "Micronesia",
            fullName: "Configure and control layers to be overlayed on the base map.",
			infoGraphic: "plugins/natural_coastal_protection/coastalprotection.jpg",
            resizable: true,
            width: 425,
            height: 740,
            showServiceLayersInLegend: false, // Disable the default legend item which doesn't pick up our custom class breaks
            allowIdentifyWhenActive: false,

            initialize: function(frameworkParameters, currentRegion) {
                declare.safeMixin(this, frameworkParameters);
                this.data = $.parseJSON(Data);
                this.countryConfig = $.parseJSON(CountryConfig);
                this.pluginTmpl = _.template(this.getTemplateById('plugin'));

                this.$el = $(this.container);

                // Default Settings
                this.region = "Micronesia";
                this.layerIDX = 3;

                this.bindEvents();

                this.chart = {};
                this.chart.position = {};
                this.chart.position.margin = {
                    top: 30,
                    right: 30,
                    left: 100,
                    bottom: 30
                };
                this.chart.position.width = (this.width - 10)- this.chart.position.margin.left - this.chart.position.margin.right;
                this.chart.position.height = 235  - this.chart.position.margin.top - this.chart.position.margin.bottom;

              
            },

            bindEvents: function() {
                var self = this;

                // Set event listeners.  We bind "this" where needed so the event handler can access the full
                // scope of the plugin
                this.$el.on("change", ".region-select", $.proxy(this.changeRegion, this));
                this.$el.on("click", ".stat", function(e) {self.changeScenarioClick(e);});

                this.$el.on("mouseenter", ".info-tooltip", function(e) {self.showTooltip(e);});
                this.$el.on("mouseleave", ".info-tooltip", $.proxy(this.hideTooltip, this));
                this.$el.on("mousemove", ".info-tooltip", function(e) {self.moveTooltip(e);});

                this.$el.on("click", ".js-getSnapshot", $.proxy(this.printReport, this));

            },

            // This function loads the first time the plugin is opened, or after the plugin has been closed (not minimized).
            // It sets up the layers with their default settings

            firstLoad: function() {
                this.fisheriesLayer = new ArcGISDynamicMapServiceLayer("http://dev.services2.coastalresilience.org/arcgis/rest/services/OceanWealth/Micronesia_Coral_Reef_Fisheries/MapServer", {});
                this.fisheriesLayer.setVisibleLayers([this.layerIDX]);

                this.map.addLayer(this.fisheriesLayer);
            },

            // This function runs everytime the plugin is open.  If the plugin was previously minimized, it restores the plugin
            // to it's previous state
            activate: function() {
                var self = this;
                
                this.render();
                //this.renderChart();

                // If the plugin hasn't been opened, or if it was closed (not-minimized) run the firstLoad function and reset the
                // default variables
                if (!this.fisheriesLayer || !this.fisheriesLayer.visible) {
                    
                    this.firstLoad();
                    this.region = "Micronesia";
                    this.layer = "Fishing_Pressure_M1";
                    //this.period = "ANN";
                    //this.layer = "people";
                    //this.variable = "PF";
                }

                // Restore storm period radios

                // restore state of people, capital, area selector
                this.$el.find(".stat.active").removeClass("active");
                $(".stat[data-layer='" + this.layer + "']").addClass("active");

                // Restore state of region select
                this.$el.find(".region-select").val(this.region);

                this.changeRegion();

                this.changeScenario();

            },

            // format a number with commas
            numberWithCommas: function (number) {
                return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            },

            // Change the default region.  If global, zoom to the full extent and show data for all countries.  If regional,
            // zoom to the country based on the bookmark in the extent-bookmarks.json file and hide data for all other countries
            changeRegion: function() {
                this.region = this.$el.find(".region-select").val();

                // Show/hide the download country summary button
                /*if (this.region === "Global") {
                    this.$el.find(".js-getSnapshot").hide();
                } else {
                    this.$el.find(".js-getSnapshot").show();
                }*/

                var layerDefs = [];
                var regionExtent = this.countryConfig[this.region].EXTENT;

                var extent = new esri.geometry.Extent(regionExtent[0],regionExtent[1],regionExtent[2],regionExtent[3]);
                this.map.setExtent(extent);

                // Set the data extent
                /*if (this.region === "Global") {
                    layerDefs[0] = ""; //this.activeCountries;
                } else if (this.region === "US/Puerto Rico") {
                    layerDefs[0] = "COUNTRY='United States & Puerto Rico'";
                } else {
                    layerDefs[0] = "COUNTRY='" + this.region + "'";
                }*/
                //this.coastalProtectionLayer.setLayerDefinitions(layerDefs);
                this.map.setExtent(extent);

                //this.updateChart();

                var pressure = this.data[this.region].Fishing_Pressure_M1.mean;
                var stock = this.data[this.region].Standing_Stock_M2.mean;
                var biomass = this.data[this.region].Biomass_Ratio_M11.mean;
                var predicted = this.data[this.region].Percent_Gain_M4.mean;
                var recovery = this.data[this.region].Recovery_Years_M12.mean;

                this.$el.find(".stat[data-layer='Fishing_Pressure_M1'] .variable").html(pressure);
                this.$el.find(".stat[data-layer='Standing_Stock_M2'] .variable").html(stock);
                this.$el.find(".stat[data-layer='Biomass_Ratio_M11'] .variable").html(biomass);
                this.$el.find(".stat[data-layer='Percent_Gain_M4'] .variable").html(predicted);
                this.$el.find(".stat[data-layer='Recovery_Years_M12'] .variable").html(recovery);

            },

            // Capture the click from the fact number click events and pass to the changeScenario function
            changeScenarioClick: function(e) {
                this.layer = $(e.currentTarget).closest(".stat").data("layer");
                this.layerIDX = $(e.currentTarget).closest(".stat").data("layer-idx");
                
                this.changeScenario();
            },

            // Update the renderer to reflect storm return period and the fact being displayed.
            changeScenario: function() {
                this.$el.find(".stat.active").removeClass("active");
                $(".stat[data-layer='" + this.layer + "']").addClass("active");

                this.fisheriesLayer.setVisibleLayers([this.layerIDX]);
                //this.fisheriesLayer.refresh();

                //this.updateChart();
                //this.updateLegend();
                
            },

            // Render the plugin DOM
            render: function() {
                var $el = $(this.pluginTmpl({
                    global: this.data.Micronesia,
                    regions: this.data,
                    pane: this.app.paneNumber
                }));

                $(this.container).empty().append($el);

            },

            // Draw the custom legend based on our custom class breaks and the current visibility of each layer
            updateLegend: function () {
                var html = "";


                if (this.fisheriesLayer.visible) {
                    if (this.layer === "people") {
                        html += "People Protected (No.)<br>";
                    } else if (this.layer === "capital") {
                        html += "Built Capital Protected ($Millions)<br>";
                    } else if (this.layer === "area") {
                        html += "Area Protected (sq km)<br>";
                    }

                    _.each(this.mapClassBreaks[this.layer], function (classbreak) {
                        html += "<span style='background: rgb(";
                        html += classbreak[2][0] + ",";
                        html += classbreak[2][1] + ",";
                        html += classbreak[2][2];
                        html += ")' class='legend-item coastal-protection'></span>";
                        html += classbreak[3] + "<br>";
                    }, this);

                    
                }

                $(this.legendContainer).show().html(html);

                return html;
            },

            // Show graph tooltip on hover
            showGraphTooltip: function(d, self) {
                self.$el.find(".ncp-tooltip").html(parseInt(d.y).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")).css({width: "auto"}).show();
            },

            // Track graph tooltip to mouse movement
            moveGraphTooltip: function(d, el, self) {
                var offset = this.$el.offset();
                var x = d3.event.pageX - offset.left;
                var y = d3.event.pageY - offset.top;
                this.$el.find(".ncp-tooltip").css({left: x + 5, top: y});
            },

            // Show info tooltip on mouse hover
            showTooltip: function(e) {
                var text = $(e.currentTarget).data("tooltip");
                this.$el.find(".ncp-tooltip").html(text).css({width: "240"}).show();
            },

            // Hide graph and info tooltip on mouseout
            hideTooltip: function() {
                this.$el.find(".ncp-tooltip").empty().hide();
            },

            // Track info tooltip to mouse movement
            moveTooltip: function(e) {
                var offset = this.$el.offset();
                var x = e.pageX - offset.left;
                var y = e.pageY - offset.top;
                this.$el.find(".ncp-tooltip").css({left: x + 5, top: y});
            },

            // Render the D3 Chart
            renderChart: function() {
                var self = this;

                // Our x values are always the same.  Treat them as ordinal and hard code them here
                this.chart.x = d3.scale.ordinal()
                    .domain([0, 10, 25, 50, 100])
                    .rangePoints([0, this.chart.position.width]);

                // The x-axis for the bar chart is also ordinal with two values
                this.chart.barx = d3.scale.ordinal()
                    .domain(["Present", "Reef Loss"])
                    .rangeRoundBands([0, this.chart.position.width], 0.15);

                this.chart.y = d3.scale.linear()
                    .range([this.chart.position.height-20,0]);

                this.chart.xAxis = d3.svg.axis()
                    .scale(this.chart.x)
                    .orient("bottom");

                this.chart.barxAxis = d3.svg.axis()
                    .scale(this.chart.barx)
                    .orient("bottom");

                this.chart.yAxis = d3.svg.axis()
                    .scale(this.chart.y)
                    .orient("left").ticks(5);

                this.chart.area = {};
                this.chart.area.current = d3.svg.area()
                    .x(function(d) { return self.chart.x(d.x); })
                    .y0(this.chart.position.height - 20)
                    .y1(function(d) { return self.chart.y(d.y); });

                this.chart.area.scenario = d3.svg.area()
                    .x(function(d) { return self.chart.x(d.x); })
                    .y0(this.chart.position.height - 20)
                    .y1(function(d) { return self.chart.y(d.y); });

                this.chart.valueline = d3.svg.line()
                    .x(function(d) { return self.chart.x(d.x); })
                    .y(function(d) { return self.chart.y(d.y); });
                
                var $chartContainer = this.$el.find(".chartContainer");

                this.chart.svg = d3.selectAll($chartContainer.toArray())
                    .append("svg")
                        .attr("width", this.chart.position.width + this.chart.position.margin.left + this.chart.position.margin.right)
                        .attr("height", this.chart.position.height + this.chart.position.margin.top + this.chart.position.margin.bottom)
                    .append("g")
                        .attr("transform", "translate(" + this.chart.position.margin.left + "," + this.chart.position.margin.right + ")");

                // Add a chart background object that can be styled separately
                this.chart.svg.append("rect")
                    .attr("class", "chart-area")
                    .attr("width", this.chart.position.width)
                    .attr("height", this.chart.position.height - 20)
                    .attr("fill", "#f6f6f6");

                // Add the xaxis
                this.chart.svg.append("g")
                    .attr("opacity", 0)
                    .attr("class", "xaxis")
                    .attr("transform", "translate(0," + (this.chart.position.height-20) + ")")
                    .call(this.chart.xAxis);

                // Add the xaxis for the bar chart
                this.chart.svg.append("g")
                    .attr("opacity", 1)
                    .attr("class", "barxaxis")
                    .attr("transform", "translate(0," + (this.chart.position.height-20) + ")")
                    .call(this.chart.barxAxis);

                // Add the x-axis label
                this.chart.svg.append("text")
                    .attr("class", "xaxis-label")
                    .attr("opacity", 0)
                    .attr("text-anchor", "middle")
                    .attr("transform", "translate(" + (this.chart.position.width / 2) + "," + (this.chart.position.height + 20) + ")")
                    .text("Storm Return Period");

                // Add the y-axis label
                this.chart.svg.append("text")
                    .attr("class", "yaxis-label")
                    .attr("transform", "rotate(-90)")
                    .attr("y", 0 - this.chart.position.margin.left + 20)
                    .attr("x", 0 - (this.chart.position.height / 2))
                    .attr("text-anchor", "middle")
                    .text("People at Risk (No.)");

                this.chart.svg.append("g")
                    .attr("class", "yaxis")
                    .call(this.chart.yAxis);

                // Add chart legend
                this.chart.legend = this.chart.svg.append("g")
                    .attr("class", "chart-legend")
                    .attr("opacity", 0);

                    this.chart.legend.append("rect")
                        .attr("width", "25")
                        .attr("height", "15")
                        .attr("x", "5")
                        .attr("fill", "#30928D");

                    this.chart.legend.append("text")
                        .text("Present")
                        .attr("x", "32")
                        .attr("y", "11");
                    
                    this.chart.legend.append("rect")
                        .attr("width", "25")
                        .attr("height", "15")
                        .attr("x", "5")
                        .attr("y", "18")
                        .attr("fill", "#923034");

                    this.chart.legend.append("text")
                        .text("Reef Loss")
                        .attr("x", "32")
                        .attr("y", "29");

                // Initialize chart data 
                this.addChartPoints();


            },

            // Initialize the chart points with empty values
            addChartPoints: function() {
                var self = this;
                this.chart.data = {};
                this.chart.data.current = {};
                this.chart.data.current.x = [0,10,25,50,100];
                this.chart.data.current.barx = ["Present", "Reef Loss"];
                this.chart.data.current.y = [0,0,0,0,0];
                this.chart.data.current.xy = [];

                this.chart.data.scenario = {};
                this.chart.data.scenario.x = [0,10,25,50,100];
                this.chart.data.scenario.barx = ["Present", "Reem Loss"];
                this.chart.data.scenario.y = [0,0,0,0,0];
                this.chart.data.scenario.xy = [];

                // Create an array of xy point data for the current scenario
                for (var i=0; i<this.chart.data.current.x.length; i++) {
                    this.chart.data.current.xy.push(
                        {
                            x: this.chart.data.current.x[i], 
                            y: this.chart.data.current.y[i]
                        }
                    );
                }

                // Create an array of xy point data for the 1m loss scenario
                for (var j=0; j<this.chart.data.scenario.x.length; j++) {
                    this.chart.data.scenario.xy.push(
                        {
                            x: this.chart.data.scenario.x[j],
                            y: this.chart.data.scenario.y[j]
                        }
                    );
                }

                // Attach the 1m loss data
                this.chart.svg
                    .data([this.chart.data.scenario.xy])
                    .append("path")
                    .attr("opacity", 0)
                    .attr("class", "area-scenario")
                    .attr("d", this.chart.area.scenario);

                // Attach the current scenario data
                this.chart.svg
                    .data([this.chart.data.current.xy])
                    .append("path")
                    .attr("opacity", 0)
                    .attr("class", "area-current")
                    .attr("d", this.chart.area.current);

                // Create an interpolation line between points
                this.chart.svg
                    .append("path")
                    .attr("class", "line current")
                    .attr("opacity", 0)
                    .attr("d", this.chart.valueline(this.chart.data.current.xy));

                this.chart.pointscurrent = this.chart.svg.append("g")
                    .attr("class", "points-current");

                // Add circles for each current scenario point and show value on mouseover
                this.chart.pointscurrent.selectAll('circle')
                    .data(this.chart.data.current.xy)
                    .enter().append('circle')
                    .attr("opacity", 0)
                    .attr("cx", function(d) { return self.chart.x(d.x); })
                    .attr("cy", function(d) { return self.chart.y(d.y); })
                    .attr("r", 3.5)
                    .on("mouseover", function(e) {
                        self.showGraphTooltip(e, self);
                    })
                    .on("mousemove", function(d) {
                        self.moveGraphTooltip(d, this, self);
                    })
                    .on("mouseout", function() {
                        self.hideTooltip(self);
                    });

                this.chart.svg
                    .append("path")
                    .attr("opacity", 0)
                    .attr("class", "line scenario")
                    .attr("d", this.chart.valueline(this.chart.data.scenario.xy));

                this.chart.pointsscenario = this.chart.svg.append("g")
                    .attr("class", "points-scenario");

                // Add circles for each 1m loss scenario point and show value on mouseover
                this.chart.pointsscenario.selectAll('circle')
                    .data(this.chart.data.scenario.xy)
                    .enter().append('circle')
                    .attr("opacity", 0)
                    .attr("cx", function(d) { return self.chart.x(d.x); })
                    .attr("cy", function(d) { return self.chart.y(d.y); })
                    .attr("r", 3.5)
                    .on("mouseover", function(e) {
                        self.showGraphTooltip(e, self);
                    })
                    .on("mousemove", function(d) {
                        self.moveGraphTooltip(d, this, self);
                    })
                    .on("mouseout", function() {
                        self.hideTooltip(self);
                    });

                // Bar chart
                var bardata = [
                    {x: "Present", y: 0},
                    {x: "Reef Loss", y: 0}
                ];

                this.chart.svg.selectAll(".bar")
                    .data(bardata)
                    .enter().append("rect")
                    .attr("opacity", 0)
                    .attr("class", "bar")
                    .attr("x", function(d) { return self.chart.barx(d.x); })
                    .attr("width", 30)
                    .attr("y", function(d) { return self.chart.y(d.y); })
                    .on("mouseover", function(e) {
                        self.showGraphTooltip(e, self);
                    })
                    .on("mousemove", function(d) {
                        self.moveGraphTooltip(d, this, self);
                    })
                    .on("mouseout", function() {
                        self.hideTooltip(self);
                    });

                //this.updateChart();

            },

            // Set the chart data to match the current variable
            updateChart: function() {
                var self = this;

                // Built Capital should be divided by 1 million
                var division = 1;
                if (this.variable === "BCF") {
                    division = 1000000;
                }

                var annual = false;
                if(this.period === "ANN") {
                    annual = true;
                }

                // Update the  y-axis label to match the current variable selected
                var text = "";
                if (this.variable === "BCF") {
                    text = "Built Capital at Risk ($Millions)";
                } else if (this.variable === "PF") {
                    text = "People at Risk (No.)";
                } else if (this.variable === "AF") {
                    text = "Area at Risk (sq km)";
                }

                this.chart.svg.select(".yaxis-label")
                        .transition().duration(600)
                        .style("opacity", 0)
                        .transition().duration(600)
                        .style("opacity", 1)
                        .text(text);

                // Get the data for the scenario from the data.json file and divide into the correct units if specified.  Default is 1
                this.chart.data.current.xy = [];
                this.chart.data.current.y = [
                    this.data[this.region]["E1_ANN_" + this.variable] / division,
                    this.data[this.region]["E1_10RP_" + this.variable] / division,
                    this.data[this.region]["E1_25RP_"+ this.variable] / division,
                    this.data[this.region]["E1_50RP_" + this.variable] / division,
                    this.data[this.region]["E1_100RP_" + this.variable] / division
                ];

                // Create array of xy values for drawing chart points
                for (var i=0; i<this.chart.data.current.x.length; i++) {
                    this.chart.data.current.xy.push(
                        {
                            x: this.chart.data.current.x[i], 
                            y: this.chart.data.current.y[i]
                        }
                    );
                }

                this.chart.data.scenario.xy = [];
                this.chart.data.scenario.y = [
                    this.data[this.region]["E2_ANN_" + this.variable] / division,
                    this.data[this.region]["E2_10RP_" + this.variable] / division,
                    this.data[this.region]["E2_25RP_"+ this.variable] / division,
                    this.data[this.region]["E2_50RP_" + this.variable] / division,
                    this.data[this.region]["E2_100RP_" + this.variable] / division
                ];

                for (var j=0; j<this.chart.data.scenario.x.length; j++) {
                    this.chart.data.scenario.xy.push(
                        {
                            x: this.chart.data.scenario.x[j], 
                            y: this.chart.data.scenario.y[j]
                        }
                    );
                }

                var bary;
                var bary1m;

                // Set the data for the bar chart
                if (this.variable === "BCF") {
                    bary = this.data[this.region].E1_ANN_BCF / division;
                    bary1m = this.data[this.region].E2_ANN_BCF / division;
                } else if (this.variable === "PF") {
                    bary = this.data[this.region].E1_ANN_PF / division;
                    bary1m = this.data[this.region].E2_ANN_PF / division;
                } else if (this.variable === "AF") {
                    bary = this.data[this.region].E1_ANN_AF / division;
                    bary1m = this.data[this.region].E2_ANN_AF / division;
                }

                var bardata = [
                    {x: "Present", y: bary},
                    {x: "Reef Loss", y: bary1m}
                ];

                if(this.period === "ANN") {
                    // Set the y-axis for the bar chart
                    this.chart.y.domain([0, bary1m]);
                } else {
                    // Set the y-axis for the line chart
                    this.chart.y.domain([0, d3.max(this.chart.data.scenario.y)]);
                    // Add a DOM class to the active point and legend text so the currently selected storm return
                    // period can be bolded in the chart
                    if (this.period === "25RP") {
                        this.chart.svg.selectAll(".xaxis .tick").classed("current", false).each(function(d, i) {
                            if ( d === 25 ) {
                                d3.select(this)
                                    .classed("current", true);
                            }
                        });
                    }
                    if (this.period === "100RP") {
                        this.chart.svg.selectAll(".xaxis .tick").classed("current", false).each(function(d, i) {
                            if ( d === 100 ) {
                                d3.select(this)
                                    .classed("current", true);
                            }
                        });
                    }
                }

                // Show and hide as appropriate all the different elements.  We animate these over the course of 1200ms
                this.chart.svg.select(".yaxis")
                    .transition().duration(1200).ease("linear")
                    .call(this.chart.yAxis);

                this.chart.svg.select(".xaxis")
                    .transition().duration(1200).ease("sin-in-out")
                    .attr("opacity", annual ? 0 : 1);

                this.chart.svg.select(".barxaxis")
                    .transition().duration(1200).ease("sin-in-out")
                    .attr("opacity", annual ? 1 : 0);

                this.chart.svg.select(".xaxis-label")
                    .transition().duration(1200).ease("sin-in-out")
                    .attr("opacity", annual ? 0 : 1);

                this.chart.legend
                    .transition().delay(750).duration(1200).ease("sin-in-out")
                    .attr("opacity", annual ? 0 : 1);

                this.chart.svg.select(".line.current")
                    .transition().duration(1200).ease("sin-in-out")
                    .attr("opacity", annual ? 0 : 1)
                    .attr("d", this.chart.valueline(this.chart.data.current.xy));

                this.chart.svg.select(".area-current")
                    .data([this.chart.data.current.xy])
                    .transition().duration(1200).ease("sin-in-out")
                    .attr("opacity", annual ? 0 : 1)
                    .attr("d", this.chart.area.current);

                // Update the chart point data and adjust point position on chart to match
                this.chart.pointscurrent.selectAll('circle')
                    .data(this.chart.data.current.xy)
                    .transition().duration(1200).ease("sin-in-out")
                    .attr("opacity", annual ? 0 : 1)
                    .attr("cx", function(d) { return self.chart.x(d.x); })
                    .attr("cy", function(d) { return self.chart.y(d.y); })
                     .attr("r", function(d) {
                        var period;
                        if (self.period === "25RP") {
                            period = 25;
                        } else if (self.period === "100RP") {
                            period = 100;
                        }
                        if (d.x === period) {
                           return 5;
                        } else {
                            return 3.5;
                        }
                    });

                // Update the position of the interpolation line to match the new point position
                this.chart.svg.select(".line.scenario")
                    .transition().duration(1200).ease("sin-in-out")
                    .attr("opacity", annual ? 0 : 1)
                    .attr("d", this.chart.valueline(this.chart.data.scenario.xy));

                this.chart.svg.select(".area-scenario")
                    .data([this.chart.data.scenario.xy])
                    .transition().duration(1200).ease("sin-in-out")
                    .attr("opacity", annual ? 0 : 1)
                    .attr("d", this.chart.area.scenario);

                this.chart.pointsscenario.selectAll('circle')
                    .data(this.chart.data.scenario.xy)
                    .transition().duration(1200).ease("sin-in-out")
                    .attr("opacity", annual ? 0 : 1)
                    .attr("cx", function(d) { return self.chart.x(d.x); })
                    .attr("cy", function(d) { return self.chart.y(d.y); })
                    .attr("r", function(d) {
                        var period;
                        if (self.period === "25RP") {
                            period = 25;
                        } else if (self.period === "100RP") {
                            period = 100;
                        }
                        if (d.x === period) {
                           return 5;
                        } else {
                            return 3.5;
                        }
                    });

                this.chart.svg.selectAll(".bar")
                    .data(bardata)
                    .transition().duration(1200).ease("sin-in-out")
                    .attr("opacity", annual ? 1 : 0)
                    .attr("width", this.chart.barx.rangeBand())
                    .attr("class", function(d) {return "bar " + d.x;})
                    .attr("x", function(d) { return self.chart.barx(d.x); })
                    .attr("y", function(d) { return self.chart.y(d.y); })
                    .attr("height", function(d) { return self.chart.position.height - 20 - self.chart.y(d.y); });
            },

            // Create a renderer for the coastal protection layer using the custom defined classbreaks and colors for each
            // scenario and fact combination
            createRenderer: function(classBreaks, field) {
                var defaultSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0,0,0,0]), 0);
                var renderer = new ClassBreaksRenderer(defaultSymbol, field);
                _(classBreaks).each(function(classBreak) {
                    renderer.addBreak({
                        minValue: classBreak[0], 
                        maxValue: classBreak[1], 
                        symbol: SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color(classBreak[2]), classBreak[4]),
                        label: classBreak[3]
                    });
                });
                return renderer;
            },

            // Download the pdf report for the current region
            printReport: function() {
                window.open(this.countryConfig[this.region].SNAPSHOT, '_blank'); 
                return false;
            },

            // Get the requested template from the template file based on id.
            // We currently only have one template for this plugin
            getTemplateById: function(id) {
                return $('<div>').append(templates)
                    .find('#' + id)
                    .html().trim();
            },

            // Turn of the layers when hibernating
            hibernate: function () {
                // Cleanup
                if (this.fisheriesLayer) {
                    this.fisheriesLayer.hide();
                }
                $(this.legendContainer).hide().html();
            }

        });
    }
);