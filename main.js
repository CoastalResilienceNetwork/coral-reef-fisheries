require({
    // Specify library locations.
    packages: [
        {
            name: 'd3',
            location: '//d3js.org',
            main: 'd3.v3.min'
        }
    ]
});

define([
    'dojo/_base/declare',
    'd3',
    'framework/PluginBase',
    'esri/layers/ArcGISDynamicMapServiceLayer',
    'esri/layers/LayerDrawingOptions',
    'esri/renderers/ClassBreaksRenderer',
    'esri/symbols/SimpleLineSymbol',
    'esri/renderer',
    'esri/tasks/query',
    'esri/tasks/QueryTask',
    'dijit/layout/ContentPane',
    'dojo/dom',
    'esri/Color',
    'dijit/Tooltip',
    './State',
    'dojo/text!./template.html',
    'dojo/text!./region.json',
    'dojo/text!./country-config.json'
    ], function(declare,
              d3,
              PluginBase,
              ArcGISDynamicMapServiceLayer,
              LayerDrawingOptions,
              ClassBreaksRenderer,
              SimpleLineSymbol,
              Renderer,
              Query,
              QueryTask,
              ContentPane,
              dom,
              Color,
              Tooltip,
              State,
              templates,
              RegionConfig,
              CountryConfig
) {
        return declare(PluginBase, {
            toolbarName: 'Fisheries',
            fullName: 'Coral Reef Fisheries',
            resizable: false,
            width: 425,
            infographic: [600, 499],
            // Disable the default legend item which doesn't pick up our custom class breaks
            showServiceLayersInLegend: true,
            allowIdentifyWhenActive: false,
            size: 'custom',

            unitStyleLookups: {
                '%': '%',
                'g/m2': 'g/m<sup>2</sup>',
                '0-1': '',
                'Years': 'Years'
            },

            initialize: function(frameworkParameters, currentRegion) {
                declare.safeMixin(this, frameworkParameters);
                this.regionConfig = $.parseJSON(RegionConfig);             
                
                var query = new Query();
                var queryTask = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.data_layer);
                this.$el = $(this.container);

                query.where = '1=1';
                query.returnGeometry = false;
                query.outFields = ['*'];
                queryTask.execute(query, _.bind(this.processData, this));

                this.countryConfig = $.parseJSON(CountryConfig);
                this.pluginTmpl = _.template(this.getTemplateById('plugin'));

                this.$el = $(this.container);

                // Default Settings
                this.state = new State();
                this.region = this.state.getRegion();
                this.subregion = this.state.getSubregion();
                this.layerIDX = this.state.getLayerIDX();
                this.layerBahamasIDX = this.state.getLayerBahamasIDX();
                this.layerMicronesiaIDX = this.state.getLayerMicronesiaIDX();
                this.layerFloridaIDX = this.state.getLayerFloridaIDX();
                this.layer = this.state.getLayer();


                this.bindEvents();

                this.chart = {};
                this.chart.position = {};
                this.chart.position.margin = {
                    top: 30,
                    right: 15,
                    left: 150,
                    bottom: 70
                };
                this.chart.position.width = (this.width - 30) -
                    this.chart.position.margin.left - this.chart.position.margin.right;
                this.chart.position.height = 285 - this.chart.position.margin.top -
                    this.chart.position.margin.bottom;
            },

            processData: function(data) {
                var transformedData = [];
                var that = this;
                $.each(data.features, function(idx, datum) {
                    transformedData.push(datum.attributes);
                });
                this.data = transformedData;
                this.regions = _(this.data).chain().pluck('REGION').uniq().value();
                this.subregions = _(this.data).chain().where({
                    'REGION': this.region
                }).pluck('SUBREGION').uniq().value().sort(function(a,b) {
                    if (a === that.region) {
                        return -1
                    } else if (b === that.region) {
                        return 1;
                    }
                    return a.localeCompare(b)
                });
            },

            bindEvents: function() {
                var self = this;

                // Set event listeners.  We bind 'this' where needed so the event
                // handler can access the full scope of the plugin
                this.$el.on('mousedown', '.subregion-select', $.proxy(this.updateSubregionText, this));
                this.$el.on('click', '.stat', function(e) {self.changeScenarioClick(e);});
                this.$el.on('click', '.js-getSnapshot', $.proxy(this.printReport, this));
            },

            setState: function(data) {
                this.state = new State(data);
                this.region = data.region;
                this.subregion = data.subregion;
                this.layer = data.layer;
                this.layerIDX = data.layerIDX;
                this.layerBahamasIDX = data.layerBahamasIDX;
                this.layerMicronesiaIDX = data.layerMicronesiaIDX;
                this.layerFloridaIDX = data.layerFloridaIDX;
            },

            getState: function() {
                return {
                    region: this.state.getRegion(),
                    subregion: this.state.getSubregion(),
                    layer: this.state.getLayer(),
                    layerIDX: this.state.getLayerIDX(),
                    layerBahamasIDX: this.state.getLayerBahamasIDX(),
                    layerMicronesiaIDX: this.state.getLayerMicronesiaIDX(),
                    layerFloridaIDX: this.state.getLayerFloridaIDX()
                };
            },

            // This function loads the first time the plugin is opened, or after the plugin
            // has been closed (not minimized). It sets up the layers with their default settings

            firstLoad: function() {
                this.fisheriesLayer = new ArcGISDynamicMapServiceLayer(this.regionConfig.service, {});
                this.fisheriesLayer.setVisibleLayers([this.layerIDX]);

                this.map.addLayer(this.fisheriesLayer);
            },

            // This function runs everytime the plugin is open.  If the plugin was previously
            // minimized, it restores the plugin to it's previous state
            activate: function() {
                var self = this;
                this.$el.prev('.sidebar-nav').find('.nav-title').css('margin-left', '25px');

                this.render();
                this.renderChart();

                this.region = this.state.getRegion();
                this.subregion = this.state.getSubregion();
                this.layer = this.state.getLayer();
                this.layerIDX = this.state.getLayerIDX();
                this.layerBahamasIDX = this.state.getLayerBahamasIDX();
                this.layerMicronesiaIDX = this.state.getLayerMicronesiaIDX();
                this.layerFloridaIDX = this.state.getLayerFloridaIDX();

                // If the plugin hasn't been opened, or if it was closed (not-minimized)
                // run the firstLoad function and reset the default variables
                if (!this.fisheriesLayer || !this.fisheriesLayer.visible) {
                    this.firstLoad();
                }

                // restore state of people, capital, area selector
                this.$el.find('.stat.active').removeClass('active');
                this.$el.find('.stat[data-layer="' + this.layer + '"]').addClass('active');

                // Restore state of region select
                this.$el.find('#crf-select-subregion').val(this.subregion).trigger('chosen:updated');

                this.changeRegion();
                this.changeSubregion();

                this.changeScenario();
            },

            // credit: https://bl.ocks.org/mbostock/7555321
            wrap: function (text, width) {
                text.each(function() {
                  var text = d3.select(this),
                      words = text.text().split(/\s+/).reverse(),
                      word,
                      line = [],
                      lineNumber = 0,
                      lineHeight = 0.7, // ems
                      x = text.attr('x')
                      y = text.attr("y"),
                      dy = parseFloat(text.attr("dy")),
                      tspan = text.text(null).append("tspan").attr("x", -10).attr("y", y).attr("dy", dy + "em");

                  while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > width) {
                      line.pop();
                      tspan.text(line.join(" "));
                      line = [word];
                      
                     text.select("tspan").attr('dy', '-4')
                      tspan = text.append("tspan").attr("x", x).attr("dy", '16').text(word);
                      lineNumber++
                    }
                  }                  
                });
              },

            // format a number with commas
            numberWithCommas: function(number) {
                return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            },

            // We have some long labels that have shorter abbreviations.  This function resets all
            // the options to their long text versions.  This should fire everytime the select
            // list is about to open
            updateSubregionText: function(e) {
                this.$el.find('.subregion-select option').each(function(idx, el) {
                    $(el).text($(el).data('text'));
                });
            },

            changeRegion: function() {
                var that = this;
                this.$el.find('#crf-select-region').val(this.region).trigger('chosen:updated');
                var select = this.$el.find('#crf-select-subregion');
                this.state = this.state.setRegion(this.region);
                this.subregions = _(this.data).chain().where({
                    'REGION': this.region
                }).pluck('SUBREGION').uniq().value().sort(function(a,b) {
                    if (a === that.region) {
                        return -1
                    } else if (b === that.region) {
                        return 1;
                    }
                    return a.localeCompare(b)
                });

                if (this.region === 'Bahamas') {
                    this.$el.find('#tech-report-link').attr('href', 'http://media.coastalresilience.org/MOW/TNC%20Bahamas%20final%20report%20v1.1.pdf');
                } else if (this.region === 'Florida') {
                    this.$el.find('#tech-report-link').attr('href', 'https://oceanwealth.org/wp-content/uploads/2020/11/FL-fish-and-fisheries-Phase2_Final-Report.pdf');
                } else {
                    this.$el.find('#tech-report-link').attr('href', 'http://ow-maps.coastalresilience.org/Reports/TNC%20final%20technical%20report%20v1.1.pdf');
                }

                if (this.region === 'Florida') {
                    this.$el.find('[data-layer="Fishing_Pressure"] i').attr('title', 'Estimated cumulative fishing impact using biomass of snapper-grouper complex scaled from 0 (no fishing) to 1 (highest fishing in region)');
                    this.$el.find('[data-layer="Standing_Stock"] i').attr('title', 'Predicted current total biomass of all species documented in Reef Visual Census surveys');
                } else {
                    this.$el.find('[data-layer="Fishing_Pressure"] i').attr('title', 'Estimated current fishing pressure on coral reef fisheries using the impact on size of parrotfish scaled from 0 (No fishing) to 1 (Highest fishing in region)');
                    this.$el.find('[data-layer="Standing_Stock"] i').attr('title', 'Predicted current biomass 19 key coral reef fishery species including, Orange-spine surgeonfish, Blue-spine unicornfish, Bluefin trevally, Chub or drummer, Humphead wrasse, Orange-striped emperor, Longface emperor, Two-spot red snapper, Humpback red snapper, Bicolour parrotfish, Steephead parrotfish, Bullethead parrotfish, Pacific longnose parrotfish, Redlip parrotfish, Brown-marbled grouper, Camouflage grouper, Black-saddled coral grouper, Forktail rabbitfish, and Gold-spotted rabbitfish.')
                }

                select.html('');
                _(this.subregions).each(function(subregion){
                    select.append($('<option value="' + subregion + '">' + subregion + '</option>'));
                });
                select.trigger('chosen:updated');
                this.changeSubregion();
            },

            // Change the default subregion.  If global, zoom to the full extent and show data
            // for all countries.  If subregional, zoom to the country based on the bookmark in
            // the extent-bookmarks.json file and hide data for all other countries
            changeSubregion: function() {
                var self = this;
                this.subregion = this.$el.find('#crf-select-subregion').val();
                this.state = this.state.setSubregion(this.subregion);

                if (self.countryConfig[self.subregion].SNAPSHOT) {
                    this.$el.find('.js-getSnapshot').show();
                } else {
                    this.$el.find('.js-getSnapshot').hide();
                }

                this.setLayerDefinitions();

                var subregionExtent = this.countryConfig[this.subregion].EXTENT;
                var extent = new esri.geometry.Extent(
                    subregionExtent[0],
                    subregionExtent[1],
                    subregionExtent[2],
                    subregionExtent[3]
                );
                
                window.setTimeout(function() {
                    self.map.setExtent(extent);
                }, 1)

                var datum = _(self.data).where({
                    REGION: self.region,
                    SUBREGION: this.subregion,
                });

                var pressure = _(datum).find({PARAMETER: 'Fishing_Pressure'}).MEAN;
                var stock = _(datum).find({PARAMETER: 'Standing_Stock'}).MEAN;
                var predicted = _(datum).find({PARAMETER: 'Percent_Gain'}).MEAN;
                var recovery = _(datum).find({PARAMETER: 'Recovery_Years'}).MEAN;

                if (self.region === 'Florida') {
                    stock = (stock / 10).toFixed(2)
                }

                this.$el.find('.stat[data-layer="Fishing_Pressure"] .variable').html(pressure);
                this.$el.find('.stat[data-layer="Standing_Stock"] .variable').html(stock);
                this.$el.find('.stat[data-layer="Percent_Gain"] .variable').html(predicted);
                this.$el.find('.stat[data-layer="Recovery_Years"] .variable').html(recovery);

                this.updateChart();

                ga('send', 'event', {
                    eventCategory: 'MAR',
                    eventAction: 'change region',
                    eventLabel: this.subregion
                });
            },

            setLayerDefinitions: function() {
                if (this.subregion === 'Micronesia' || this.subregion === 'Bahamas' || this.subregion === 'Florida') {
                    if (this.region === 'Micronesia') {
                        this.layerIDX = this.layerMicronesiaIDX;
                    } else if (this.region === 'Bahamas') {
                        this.layerIDX = this.layerBahamasIDX;
                    } else if (this.region === 'Florida') {
                        this.layerIDX = this.layerFloridaIDX;
                    }
                    this.fisheriesLayer.setVisibleLayers([this.layerIDX]);
                    this.fisheriesLayer.setLayerDefinitions([]);
                } else {
                    var layerDefs = [];
                    var params = this.countryConfig[this.subregion].query;

                    if (this.region === 'Micronesia') {
                        this.layerIDX = this.layerMicronesiaIDX;
                    } else if (this.region === 'Bahamas') {
                        this.layerIDX = this.layerBahamasIDX;
                    } else if (this.region === 'Florida') {
                        this.layerIDX = this.layerFloridaIDX;
                    }

                    this.fisheriesLayer.setVisibleLayers([this.layerIDX]);
                    layerDefs[this.layerIDX] = params.type + '=\'' + params.label + '\'';

                    this.fisheriesLayer.setLayerDefinitions(layerDefs);
                }
            },

            // Capture the click from the fact number click events and pass to the
            // changeScenario function
            changeScenarioClick: function(e) {
                this.layer = $(e.currentTarget).closest('.stat').data('layer');
                this.layerBahamasIDX = $(e.currentTarget).closest('.stat').data('layer-bahamas-idx');
                this.layerMicronesiaIDX = $(e.currentTarget).closest('.stat').data('layer-micronesia-idx');
                this.layerFloridaIDX = $(e.currentTarget).closest('.stat').data('layer-florida-idx');

                if (this.region === 'Micronesia') {
                    this.layerIDX = this.layerMicronesiaIDX;
                } else if (this.region === 'Bahamas') {
                    this.layerIDX = this.layerBahamasIDX;
                } else if (this.region === 'Florida') {
                    this.layerIDX = this.layerFloridaIDX;
                }

                this.setLayerDefinitions();
                this.changeScenario();
            },

            // Update the renderer to reflect storm return period and the fact being displayed.
            changeScenario: function() {
                this.$el.find('.stat.active').removeClass('active');
                this.$el.find('.stat[data-layer="' + this.layer + '"]').addClass('active');
                if (this.region === 'Micronesia') {
                    this.layerIDX = this.layerMicronesiaIDX;
                } else if (this.region === 'Bahamas') {
                    this.layerIDX = this.layerBahamasIDX;
                } else if (this.region === 'Florida') {
                    this.layerIDX = this.layerFloridaIDX;
                }
                if (this.region === 'Micronesia') {
                    this.fisheriesLayer.setVisibleLayers([this.layerMicronesiaIDX]);
                } else if (this.region === 'Bahamas') {
                    this.fisheriesLayer.setVisibleLayers([this.layerBahamasIDX]);
                } else if (this.region === 'Florida') {
                    this.fisheriesLayer.setVisibleLayers([this.layerFloridaIDX]);
                }
                this.state = this.state.setLayer(this.layer);

                if (this.region === 'Micronesia') {
                    this.state = this.state.setLayerIDX(this.layerMicronesiaIDX);
                } else if (this.region === 'Bahamas') {
                    this.state = this.state.setLayerIDX(this.layerBahamasIDX);
                } else if (this.region === 'Florida') {
                    this.state = this.state.setLayerIDX(this.layerFloridaIDX);
                }
                
                this.updateChart();
            },

            // Render the plugin DOM

            render: function() {
                var self = this;
                var subregions = _(this.data).chain().where({'REGION': this.region}).pluck('SUBREGION').uniq().value();
                var selectedData = _(this.data).where({ SUBREGION: this.subregion });

                var $el = $(this.pluginTmpl({
                    global: this.data.Micronesia,
                    regions: this.regions,
                    subregions: subregions,
                    selectedData: selectedData,
                    pane: this.app.paneNumber,
                    config: this.countryConfig,
                    units: this.unitStyleLookups
                }));

                this.appDiv = new ContentPane({
                    style: 'padding:0; color:#000; flex:1; display:flex; flex-direction:column;}'
                });
                this.id = this.appDiv.id;
                $(dom.byId(this.container)).addClass('sty_flexColumn');
                this.$el.html(this.appDiv.domNode);
                // Get html from content.html, prepend appDiv.id to html element id's,
                // and add to appDiv
                var idUpdate = this.pluginTmpl({
                    global: this.data.Micronesia,
                    regions: this.regions,
                    subregions: subregions,
                    selectedData: selectedData,
                    pane: this.app.paneNumber,
                    config: this.countryConfig,
                    units: this.unitStyleLookups}).replace(/id='/g, "id='" + this.id);
                this.$el.find('#' + this.id).html(idUpdate);

                $(this.container).parent().find('.viewCrsInfoGraphicIcon').remove();

                this.$el.find('#crf-select-region').chosen({
                    disable_search_threshold: 20,
                    width: '160px'
                }).on('change', function(e, params) {
                    self.region = params.selected;
                    self.changeRegion();
                });

                this.$el.find('#crf-select-subregion').chosen({
                    disable_search_threshold: 20,
                    width: '183px'
                }).on('change', function(e, params) {
                    // Show abbreviation when label is set in the parameters
                    var label = self.countryConfig[params.selected].label;
                    if (label) {
                        self.$el.find('#crf-select-subregion + .chosen-container > .chosen-single span').html(label);
                    }
                    self.changeSubregion();
                });
            },

            // Render the D3 Chart
            renderChart: function() {
                var self = this;
                var countryCount = _(this.data).chain().where({'REGION': this.region}).pluck('SUBREGION').uniq().value().length;
                this.chart.position.height = 140 + (countryCount * 20);

                this.chart.y = d3.scale.ordinal()
                    .domain(this.subregions)
                    .rangeBands([0, this.chart.position.height - this.chart.position.margin.bottom], 0.7, 0.3);

                var xAxisMin = _(this.data).chain().where({
                    REGION: self.region,
                    PARAMETER: self.layer
                }).map(function(a){return a.MIN;}).min().value();

                var xAxisMax = _(this.data).chain().where({
                    REGION: self.region,
                    PARAMETER: self.layer
                }).map(function(a){return a.MAX;}).max().value();

                this.chart.x = d3.scale.linear()
                    .domain([xAxisMin, xAxisMax])
                    .range([0, this.chart.position.width - 20]);

                var $chartContainer = this.$el.find('.chartContainer');

                this.chart.svg = d3.selectAll($chartContainer.toArray())
                    .append('svg')
                        .attr('width', this.chart.position.width + this.chart.position.margin.left +
                                this.chart.position.margin.right)
                        .attr('height', this.chart.position.height +
                                this.chart.position.margin.top + this.chart.position.margin.bottom)
                    .append('g')
                        .attr('transform', 'translate(' + this.chart.position.margin.left + ',' +
                                this.chart.position.margin.right + ')');

                this.chart.yAxis = d3.svg.axis()
                    .scale(this.chart.y)
                    .tickFormat(function(d) {
                        if (self.countryConfig[d].label) {
                            return self.countryConfig[d].label;
                        } else {
                            return d;
                        }
                    })
                    .orient('left');
                
                this.chart.svg.selectAll('.yaxis .tick text').call(this.wrap, 100);

                this.chart.xAxis = d3.svg.axis()
                    .scale(this.chart.x)
                    .ticks(5)
                    .orient('top');

                this.chart.svg.append('g')
                    .attr('class', 'yaxis')
                    .attr('transform', 'translate(-3, 45)')
                    .call(this.chart.yAxis);

                // Add the xaxis
                this.chart.svg.append('g')
                    .attr('class', 'xaxis')
                    .call(this.chart.xAxis);

                this.xAxisLabel = this.chart.svg.append('text')
                    .attr('class', 'xaxis-label')
                    .attr('y', 0)
                    .attr('x', 50)
                    .attr('text-anchor', 'middle');

                this.chart.chartData = this.chart.svg.append('g')
                    .attr('class', 'chart-data')
                    .attr('transform', 'translate(0,45)');

                /*this.allCountryNames = _(this.data).chain().pluck('SUBREGION').uniq().value();
                this.visibleCountryNames = _(this.data).chain().where({'REGION': this.region}).pluck('SUBREGION').uniq().value();



                    .attr('cursor', 'pointer')
                    .on('click', function(d) {
                        self.$el.find('#crf-select-subregion').val(d).trigger('chosen:updated');
                        var label = self.countryConfig[d].label;
                        if (label) {
                            self.$el.find('.chosen-single span').html(label);
                        }
                        self.changeSubregion();
                    });

                
*/
            },

            // Set the chart data to match the current variable
            updateChart: function() {
                var self = this;
                var visibleCountryNames = _(this.data).chain().where({'REGION': this.region}).pluck('SUBREGION').uniq().value();
                var countryCount = _(this.data).chain().where({'REGION': this.region}).pluck('SUBREGION').uniq().value().length;
                this.chart.position.height = 140 + (countryCount * 20);

                // Resize the height of the chart to fit the number of sub-regions
                d3.selectAll(this.$el.find('.chartContainer').toArray()).select('svg')
                    .attr('height', this.chart.position.height);

                var unit = _(this.data).find({
                    REGION: this.region,
                    PARAMETER: this.layer
                }).UNIT;

                var xAxisMin = _(this.data).chain().where({
                    REGION: self.region,
                    PARAMETER: self.layer
                }).map(function(a){return a.MIN;}).min().value();

                var xAxisMax = _(this.data).chain().where({
                    REGION: self.region,
                    PARAMETER: self.layer
                }).map(function(a){return a.MAX;}).max().value();

                this.chart.x
                    .domain([xAxisMin, xAxisMax]);

                this.xAxisLabel
                    .text(this.$el.find('.stat.active .description').text() +
                        '(' + unit + ')')
                    .transition().duration(1000);

                this.chart.y
                    .domain(this.subregions)
                    .rangeBands([0, this.chart.position.height - this.chart.position.margin.bottom], 0.4);

                this.chart.svg.selectAll('.xaxis')
                    .attr('transform', 'translate(0, 40)')
                    .call(this.chart.xAxis);

                this.chart.svg.selectAll('.yaxis')
                    .transition().duration(1000)
                    .call(this.chart.yAxis);

                this.chart.svg.selectAll('.yaxis .tick text')
                    .call(this.wrap, 150);

                // Change datasets

                var boxes = this.chart.chartData.selectAll('.box')
                    .data(visibleCountryNames, function(d){
                        return d;
                    });

                boxes.exit().remove();

                boxes = boxes.enter().append('g')
                    .attr('data-country', function(d) {
                        return d;
                    })
                    .attr('class', 'box info-tooltip')
                    .on('click', function(d) {
                        self.$el.find('#crf-select-subregion').val(d).trigger('chosen:updated');
                        var label = self.countryConfig[d].label;
                        if (label) {
                            self.$el.find('#crf_select_subregion_chosen .chosen-single span').html(label);
                        }
                        self.changeSubregion();
                    });

                boxes.append('line')
                    .attr('class', 'whisker')
                    .attr('stroke-width', 1)
                    .attr('stroke', 'black')
                    .attr('stroke-dasharray', '3,3');

                boxes.append('line')
                    .attr('class', 'maxline')
                    .attr('stroke-width', 1)
                    .attr('stroke', 'black');

                boxes.append('line')
                    .attr('class', 'minline')
                    .attr('stroke-width', 1)
                    .attr('stroke', 'black');

                boxes.append('rect')
                    .attr('fill', 'olivedrab')
                    .attr('height', 20)
                    .attr('cursor', 'pointer');
       
                boxes.append('line')
                    .attr('class', 'median')
                    .attr('stroke-width', 1)
                    .attr('stroke', 'black');

                // Whiskers
                this.chart.chartData.selectAll('.whisker')
                    .transition().duration(1000)
                    .attr('y1', function(d, i) {
                        if (!self.chart.y(d)) {
                            return 0;
                        }
                        return self.chart.y(d) + 8;
                    })
                    .attr('y2', function(d) {
                        if (!self.chart.y(d)) {
                            return 0;
                        }
                        return self.chart.y(d) + 8;
                    })
                    .attr('x1', function(d) {
                        var datum = _(self.data).find({
                            SUBREGION: d,
                            PARAMETER: self.layer
                        }).MAX;
                        return self.chart.x(datum);
                    })
                    .attr('x2', function(d) {
                        var datum = _(self.data).find({
                            SUBREGION: d,
                            PARAMETER: self.layer
                        }).MIN;
                        return self.chart.x(datum);
                    });


                this.chart.chartData.selectAll('.maxline')
                    .transition().duration(1000)
                    .attr('y1', function(d) {
                        if (!self.chart.y(d)) {
                            return 0;
                        }
                        return self.chart.y(d);
                    })
                    .attr('y2', function(d) {
                        if (!self.chart.y(d)) {
                            return 0;
                        }
                        return self.chart.y(d) + 20;
                    })
                    .attr('x1', function(d) {
                        var datum = _(self.data).find({
                            SUBREGION: d,
                            PARAMETER: self.layer
                        }).MAX;
                        return self.chart.x(datum);
                    })
                    .attr('x2', function(d) {
                        var datum = _(self.data).find({
                            SUBREGION: d,
                            PARAMETER: self.layer
                        }).MAX;
                        return self.chart.x(datum);
                    });

                this.chart.chartData.selectAll('.minline')
                    .transition().duration(1000)
                    .attr('y1', function(d) {
                        if (!self.chart.y(d)) {
                            return 0;
                        }
                        return self.chart.y(d);
                    })
                    .attr('y2', function(d) {
                        if (!self.chart.y(d)) {
                            return 0;
                        }
                        return self.chart.y(d) + 20;
                    })
                    .attr('x1', function(d) {
                        var datum = _(self.data).find({
                            SUBREGION: d,
                            PARAMETER: self.layer
                        }).MIN;
                        return self.chart.x(datum);
                    })
                    .attr('x2', function(d) {
                        var datum = _(self.data).find({
                            SUBREGION: d,
                            PARAMETER: self.layer
                        }).MIN;
                        return self.chart.x(datum);
                    });
                
                // Boxes

                this.chart.chartData.selectAll('rect')
                    .transition().duration(1000)
                    .attr('x', function(d) {
                        var q25 = _(self.data).find({
                            SUBREGION: d,
                            PARAMETER: self.layer
                        }).Q25;
                        return self.chart.x(q25);
                    })
                    .attr('y', function(d) {
                        return self.chart.y(d);
                    })
                    .attr('width', function(d) {
                        var q75 = _(self.data).find({
                            SUBREGION: d,
                            PARAMETER: self.layer
                        }).Q75;

                        var q25 = _(self.data).find({
                            SUBREGION: d,
                            PARAMETER: self.layer
                        }).Q25;
                        return self.chart.x(q75) - self.chart.x(q25);
                    })
                    .attr('fill', function(d) {
                        if (d === self.subregion) {
                            return 'steelblue';
                        } else {
                            return 'olivedrab';
                        }
                    })
                    
                    .attr('title', function(d) {
                        var datum = _(self.data).find({
                            REGION: self.region,
                            SUBREGION: d,
                            PARAMETER: self.layer
                        });

                        var html = '';
                        html += 'max: ' + datum.MAX;
                        html += '\nthird quartile: ' + datum.Q75;
                        html += '\nmedian: ' + datum.MEDIAN;
                        html += '\nsecond quartile: ' + datum.Q25;
                        html += '\nmin: ' + datum.MIN;
                        return html;
                    });

                this.$el.find('.info-tooltip').tooltip({
                    tooltipClass: 'plugin-tooltip',
                    track: true,
                });

                // median lines
                this.chart.chartData.selectAll('.median')
                    .transition().duration(1000)
                    .attr('y1', function(d) {
                        if (!self.chart.y(d)) {
                            return 0;
                        }
                        return self.chart.y(d) + 1;
                    })
                    .attr('y2', function(d) {
                        if (!self.chart.y(d)) {
                            return 0;
                        }
                        return self.chart.y(d) + 19;
                    })
                    .attr('x1', function(d) {
                        var median = _(self.data).find({
                            SUBREGION: d,
                            PARAMETER: self.layer
                        }).MEDIAN;
                        return self.chart.x(median);
                    })
                    .attr('x2', function(d) {
                        var median = _(self.data).find({
                            SUBREGION: d,
                            PARAMETER: self.layer
                        }).MEDIAN;
                        return self.chart.x(median);
                    });
            },

            // Download the pdf report for the current subregion
            printReport: function() {
                window.open(this.countryConfig[this.subregion].SNAPSHOT, '_blank');
                return false;
            },

            // Get the requested template from the template file based on id.
            // We currently only have one template for this plugin
            getTemplateById: function(id) {
                return $('<div>').append(templates)
                    .find('#' + id)
                    .html().trim();
            },

            deactivate: function() {
                if (this.appDiv !== undefined) {
                    if (this.fisheriesLayer) {
                        this.fisheriesLayer.hide();
                    }
                    $(this.legendContainer).hide().html();
                }

                //$('.sidebar-nav .nav-title').css('margin-left', '0px');
            },

            // Turn of the layers when hibernating
            hibernate: function() {
                // Cleanup
                if (this.fisheriesLayer) {
                    this.fisheriesLayer.hide();
                }
                $(this.legendContainer).hide().html();
            }

        });
    }
);
