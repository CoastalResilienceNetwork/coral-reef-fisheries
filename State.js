'use strict';
define([
        'dojo/_base/declare',
        'underscore'
    ],
    function(declare, _) {

        var State = declare(null, {
            constructor: function(data) {
                this.savedState = _.defaults({}, data, {
                    region: 'Florida',
                    subregion: 'Florida',
                    layer: 'Fishing_Pressure',
                    layerIDX: 9,
                    layerBahamasIDX: 15,
                    layerMicronesiaIDX: 9,
                    layerFloridaIDX: 4,
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

            getLayerBahamasIDX: function() {
                return this.savedState.layerBahamasIDX;
            },

            setLayerBahamasIDX: function(layerBahamasIDX) {
                return this.clone({
                    layerBahamasIDX: layerBahamasIDX
                });
            },

            getLayerMicronesiaIDX: function() {
                return this.savedState.layerMicronesiaIDX;
            },

            setLayerMicronesiaIDX: function(layerMicronesiaIDX) {
                return this.clone({
                    layerMicronesiaIDX: layerMicronesiaIDX
                });
            },

            getLayerFloridaIDX: function() {
                return this.savedState.layerFloridaIDX;
            },

            setLayerFloridaIDX: function(layerFloridaIDX) {
                return this.clone({
                    layerFloridaIDX: layerFloridaIDX
                });
            },

            // Return new State combined with `data`.
            clone: function(data) {
                return new State(_.assign({}, this.getState(), data));
            }
        });

        return State;
    }
);
