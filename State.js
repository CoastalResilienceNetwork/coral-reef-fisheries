'use strict';
define([
        'dojo/_base/declare',
        'underscore'
    ],
    function(declare, _) {

        var State = declare(null, {
            constructor: function(data) {
                this.savedState = _.defaults({}, data, {
                    region: 'Micronesia',
                    subregion: 'Micronesia',
                    layer: 'Fishing_Pressure',
                    layerIDX: 3
                });
            },

            getState: function() {
                return this.savedState;
            },

            setSubregion: function(subregion) {
                return this.clone({
                    subregion: subregion
                });
            },

            getSubregion: function() {
                return this.savedState.subregion;
            },

            getRegion: function() {
                return this.savedState.region;
            },

            setRegion: function(region) {
                return this.clone({
                    region: region
                });
            },

            setLayer: function(layer) {
                return this.clone({
                    layer: layer
                });
            },

            getLayer: function() {
                return this.savedState.layer;
            },

            setLayerIDX: function(layerIDX) {
                return this.clone({
                    layerIDX: layerIDX
                });
            },

            getLayerIDX: function() {
                return this.savedState.layerIDX;
            },

            // Return new State combined with `data`.
            clone: function(data) {
                return new State(_.assign({}, this.getState(), data));
            }
        });

        return State;
    }
);
