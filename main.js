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
			//infoGraphic: "plugins/natural_coastal_protection/coastalprotection.jpg",
            resizable: true,
            width: 425,
            height: 740,
            showServiceLayersInLegend: true, // Disable the default legend item which doesn't pick up our custom class breaks
            allowIdentifyWhenActive: false,

            initialize: function(frameworkParameters, currentRegion) {
                declare.safeMixin(this, frameworkParameters);
                this.data = $.parseJSON(Data);
                this.countryConfig = $.parseJSON(CountryConfig);
                this.pluginTmpl = _.template(this.getTemplateById('plugin'));

                this.$el = $(this.container);

                // Default Settings
                this.layer = "Biomass_Ratio_M11";
                this.region = "Micronesia";
                this.layerIDX = 3;

                this.bindEvents();

                this.chart = {};
                this.chart.position = {};
                this.chart.position.margin = {
                    top: 30,
                    right: 30,
                    left: 60,
                    bottom: 40
                };
                this.chart.position.width = (this.width - 30)- this.chart.position.margin.left - this.chart.position.margin.right;
                this.chart.position.height = 255  - this.chart.position.margin.top - this.chart.position.margin.bottom;
              
            },

            bindEvents: function() {
                var self = this;

                // Set event listeners.  We bind "this" where needed so the event handler can access the full
                // scope of the plugin
                this.$el.on("mousedown", ".region-select", $.proxy(this.updateRegionText, this));
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
                this.renderChart();

                // If the plugin hasn't been opened, or if it was closed (not-minimized) run the firstLoad function and reset the
                // default variables
                if (!this.fisheriesLayer || !this.fisheriesLayer.visible) {
                    
                    this.firstLoad();
                    this.region = "Micronesia";
                    this.layer = "Fishing_Pressure_M1";
                }

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
            
            // We have some long labels that have shorter abbreviations.  This function resets all
            // the options to their long text versions.  This should fire everytime the select
            // list is about to open
            updateRegionText: function (e) {
                this.$el.find(".region-select option").each(function(idx, el) {
                    $(el).text($(el).data("text"));
                });
            },

            // Change the default region.  If global, zoom to the full extent and show data for all countries.  If regional,
            // zoom to the country based on the bookmark in the extent-bookmarks.json file and hide data for all other countries
            changeRegion: function() {
                var self = this;
                this.region = this.$el.find(".region-select").val();

                // When selecting a new region, if it has a shorter label, set the text value to that
                // so it shows the shorter version in the select box.
                if (self.countryConfig[self.region].label) {
                    self.$el.find(".region-select option:selected").text(self.countryConfig[self.region].label);
                }

                var regionExtent = this.countryConfig[this.region].EXTENT;
                var extent = new esri.geometry.Extent(regionExtent[0],regionExtent[1],regionExtent[2],regionExtent[3]);

                if (this.region === "Micronesia" ) {
                    this.fisheriesLayer.setLayerDefinitions([]);
                } else {
                    var layerDefs = [];
                    var params = this.countryConfig[this.region].query;
                    layerDefs[this.layerIDX] = params.type + "='" + params.label + "'";
                    this.fisheriesLayer.setLayerDefinitions(layerDefs);
                }    
                
                this.map.setExtent(extent);

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

                this.updateChart();

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

                this.updateChart();
                
            },

            // Render the plugin DOM

            render: function() {
                var $el = $(this.pluginTmpl({
                    global: this.data.Micronesia,
                    regions: this.data,
                    pane: this.app.paneNumber,
                    config: this.countryConfig
                }));

                $(this.container).empty().append($el);

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

                this.countryNames = [];
                for (var country in this.data) {
                    this.countryNames.push(country);
                }

                var countrydata = Object.keys(this.data).map(function(a) {
                    var country = {};
                    country[a] = self.data[a];
                    return country;
                });

                this.chart.x = d3.scale.ordinal()
                    .domain(this.countryNames)
                    .rangeBands([0, this.chart.position.width], 0.7, 0.3);

                this.chart.y = d3.scale.linear()
                    .domain([0, 1]) // TODO: Max and Min of whichever stat
                    .range([this.chart.position.height-20,0]);

                this.chart.xAxis = d3.svg.axis()
                    .scale(this.chart.x)
                    .tickFormat(function(d) {
                        if (self.countryConfig[d].label) {
                            return self.countryConfig[d].label;
                        } else {
                            return d;
                        }
                    })
                    .orient("bottom");

                this.chart.yAxis = d3.svg.axis()
                    .scale(this.chart.y)
                    .orient("left");

                var $chartContainer = this.$el.find(".chartContainer");

                this.chart.svg = d3.selectAll($chartContainer.toArray())
                    .append("svg")
                        .attr("width", this.chart.position.width + this.chart.position.margin.left + this.chart.position.margin.right)
                        .attr("height", this.chart.position.height + this.chart.position.margin.top + this.chart.position.margin.bottom)
                    .append("g")
                        .attr("transform", "translate(" + this.chart.position.margin.left + "," + this.chart.position.margin.right + ")");

                // Add the xaxis
                this.chart.svg.append("g")
                    .attr("class", "xaxis")
                    .attr("transform", "translate(0," + (this.chart.position.height-20) + ")")
                    .call(this.chart.xAxis)
                    .selectAll("text")
                        .attr("transform", "rotate(-45)")
                        .style("text-anchor", "end")
                    .selectAll(".tick")
                        .attr("transform", "translate(0,25)");

                this.chart.svg.append("g")
                    .attr("class", "yaxis")
                    .call(this.chart.yAxis);

                // Add the y-axis label
                this.yAxisLabel = this.chart.svg.append("text")
                    .attr("class", "yaxis-label")
                    .attr("transform", "rotate(-90)")
                    .attr("y", 0 - this.chart.position.margin.left + 20)
                    .attr("x", 0 - (this.chart.position.height / 2))
                    .attr("text-anchor", "middle");
               

                this.chart.chartData = this.chart.svg.append("g")
                    .attr("class", "chart-data")
                    .attr("transform", "translate(0,0)");

                this.chart.plots = this.chart.chartData.selectAll(".box")
                    .data(this.countryNames)
                    .enter().append('g')
                    .attr('data-country', function(d) {
                        return d;
                    })
                    .attr('class', 'box');

                // whiskers
                this.chart.whiskers = this.chart.plots.append("line")
                    .attr("class", "whisker")
                    .attr("stroke-width", 1)
                    .attr("stroke", "black")
                    .attr("stroke-dasharray", "3,3")
                    .attr("x1", function(d) {
                        return self.chart.x(d) + ((self.chart.position.width/self.countryNames.length) * 0.4);
                    })
                    .attr("x2", function(d) {
                        return self.chart.x(d) + ((self.chart.position.width/self.countryNames.length) * 0.4);
                    })
                    .attr("y1", function(d) {
                        return self.chart.y(self.data[d][self.layer].max);
                    })
                    .attr("y2", function(d) {
                        return self.chart.y(self.data[d][self.layer].min);
                    });

                // Max lines
                this.chart.maxline = this.chart.plots.append("line")
                    .attr("class", "maxline")
                    .attr("stroke-width", 1)
                    .attr("stroke", "black")
                    .attr("x1", function (d) {
                        return self.chart.x(d);
                    })
                    .attr("x2", function (d) {
                        return self.chart.x(d) + ((self.chart.position.width/self.countryNames.length) * 0.8) ;
                    })
                    .attr("y1", function(d) {
                        return self.chart.y(self.data[d][self.layer].max);
                    })
                    .attr("y2", function(d) {
                        return self.chart.y(self.data[d][self.layer].max);
                    });

                // Min lines
                this.chart.minline = this.chart.plots.append("line")
                    .attr("class", "minline")
                    .attr("stroke-width", 1)
                    .attr("stroke", "black")
                    .attr("x1", function (d) {
                        return self.chart.x(d);
                    })
                    .attr("x2", function (d) {
                        return self.chart.x(d) + ((self.chart.position.width/self.countryNames.length) * 0.8);
                    })
                    .attr("y1", function(d) {
                        return self.chart.y(self.data[d][self.layer].min);
                    })
                    .attr("y2", function(d) {
                        return self.chart.y(self.data[d][self.layer].min);
                    });

                  // Boxes
                this.chart.box = this.chart.plots.append("rect")
                    .attr("y", function(d) {
                        return self.chart.y(self.data[d][self.layer].q75);
                    })
                    .attr("height", function(d) {
                        return self.chart.y(self.data[d][self.layer].q25) - self.chart.y(self.data[d][self.layer].q75);
                    })
                    .attr("x", function(d) {
                        return self.chart.x(d);
                    })
                    .attr("fill", function(d) {
                        if (d === self.region) {
                            return "steelblue";
                        } else {
                            return "olivedrab";
                        }
                    })
                    .attr("width", (self.chart.position.width/self.countryNames.length) - ((self.chart.position.width/self.countryNames.length) * 0.2)) // 20% gap
                    .attr("cursor", "pointer")
                    .on("click", function(d) {
                        self.$el.find(".region-select").val(d);
                        self.changeRegion();
                    });

                // median lines
                this.medianline = this.chart.plots.append("line")
                    .attr("class", "median")
                    .attr("x1", function (d) {
                        return self.chart.x(d);
                    })
                    .attr("x2", function (d) {
                        return self.chart.x(d) + ((self.chart.position.width/self.countryNames.length) * 0.8);
                    })
                    .attr("y1", function(d) {
                        return self.chart.y(self.data[d][self.layer].median);
                    })
                    .attr("y2", function(d) {
                        return self.chart.y(self.data[d][self.layer].median);
                    })
                    .attr("stroke-width", 1)
                    .attr("stroke", "black");

            },

            // Set the chart data to match the current variable
            updateChart: function() {
                var self = this;

                var min = _.min(this.data, function(d) {
                    return d[self.layer].min;
                })[self.layer].min;

                var maxArray = [];
                _.each(this.data, function(d) {
                    maxArray.push(parseFloat(d[self.layer].max));
                });

                var minArray = [];
                _.each(this.data, function(d) {
                    minArray.push(parseFloat(d[self.layer].min));
                });

                this.chart.y
                    .domain([d3.min(minArray), d3.max(maxArray)]); // TODO: Max and Min of whichever stat

                this.yAxisLabel
                    .text(this.$el.find(".stat.active .description").text());

                this.chart.svg.selectAll(".yaxis")
                    .transition().duration(1000)
                    .call(this.chart.yAxis);

                // Boxes
                this.chart.box = this.chart.plots.selectAll("rect")
                    .transition().duration(1000)
                    .attr("y", function(d) {
                        return self.chart.y(self.data[d][self.layer].q75);
                    })
                    .attr("height", function(d) {
                        return self.chart.y(self.data[d][self.layer].q25) - self.chart.y(self.data[d][self.layer].q75);
                    })
                    .attr("fill", function(d) {
                        if (d === self.region) {
                            return "steelblue";
                        } else {
                            return "olivedrab";
                        }
                    });
                
                // Whiskers
                this.chart.whiskers
                    .transition().duration(1000)
                    .attr("x1", function(d) {
                        return self.chart.x(d) + ((self.chart.position.width/self.countryNames.length) * 0.4);
                    })
                    .attr("x2", function(d) {
                        return self.chart.x(d) + ((self.chart.position.width/self.countryNames.length) * 0.4);
                    })
                    .attr("y1", function(d) {
                        return self.chart.y(self.data[d][self.layer].max);
                    })
                    .attr("y2", function(d) {
                        return self.chart.y(self.data[d][self.layer].min);
                    });

                // Max lines
                this.chart.maxline
                    .transition().duration(1000)
                    .attr("y1", function(d) {
                        return self.chart.y(self.data[d][self.layer].max);
                    })
                    .attr("y2", function(d) {
                        return self.chart.y(self.data[d][self.layer].max);
                    });

                // Min lines
                this.chart.minline
                    .transition().duration(1000)
                    .attr("y1", function(d) {
                        return self.chart.y(self.data[d][self.layer].min);
                    })
                    .attr("y2", function(d) {
                        return self.chart.y(self.data[d][self.layer].min);
                    });

                // Median Lines
                this.medianline
                    .transition().duration(1000)
                    .attr("y1", function(d) {
                        return self.chart.y(self.data[d][self.layer].median);
                    })
                    .attr("y2", function(d) {
                        return self.chart.y(self.data[d][self.layer].median);
                    });


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
