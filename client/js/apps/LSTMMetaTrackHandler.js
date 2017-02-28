/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 2/28/17.
 */
class LSTMMetaTrackHandler {

    constructor({parentNode, controller, eventHandler, colorManager}) {
        this.parentNode = parentNode;
        this.controller = controller;
        this.eventHandler = eventHandler;
        this.colorManager = colorManager;

        this.addButton = d3.select('#addMetaTrackBtn');
        this.optionList = d3.select('#addMetaList');
        this.dialog = d3.select('#addMetaDialog');

        this.eventHandler.bind(LSTMController.events.projectsMetaAvailable, () => this.init())
        this.eventHandler.bind(LSTMController.events.newContextAvailable, () => this._update())

        this.availableTracks = {};
    }


    init() {

        const meta = this.controller.projectInfo.meta
        const vismeta = this.controller.visibleMeta;

        Object.keys(meta).forEach(key => this.availableTracks[key] = {type: meta[key].vis.type, key});


        this.addButton.on('click', () => {
            const metaKeys = Object.keys(this.availableTracks).filter(d => vismeta.indexOf(d) < 0);
            const metaOps = this.optionList.selectAll('option').data(metaKeys);
            metaOps.exit().remove();
            metaOps.enter().append('option')
              .merge(metaOps).attr('value', d => d).text(d => d);

            ModalDialog.open({
                rootNode: this.dialog,
                eventHandler: this.eventHandler
            })
        });

        this.eventHandler.bind(ModalDialog.events.modalDialogSubmitted,
          node => {
              if (node.attr('id') === 'addMetaDialog') {
                  const dim = this.optionList.node().value;
                  this._useTrack(dim);

                  ModalDialog.close({rootNode: node})
              }
          })

    }


    _useTrack(key) {
        const vismeta = this.controller.visibleMeta;
        this.controller.visibleMeta = [...vismeta, key];

        this.controller.requestContext({});
    }


    _unuseTrack(key) {
        const vismeta = this.controller.visibleMeta;
        vismeta.splice(vismeta.indexOf(key), 1);

        // Trigger URL update:
        this.controller.visibleMeta = vismeta;
        this._update();

    }


    _update() {
        const at = this.availableTracks;

        const visibleTracks = this.controller.visibleMeta.map(key => at[key]);

        // Change visibility of 'add' button if all tracks are displayed
        this.addButton.attr('hidden', (Object.keys(at).length == visibleTracks.length) ? true : null);

        // Update the SVGs and add append/remove visualizations
        this._updateSVGs(visibleTracks);

        // Update the visualizations
        this._updateVisualizations(visibleTracks);


    }


    _updateSVGs(visibleTracks) {

        const svgs = this.parentNode.selectAll('.metaTrack').data(visibleTracks, d => d.key);
        svgs.exit().each(track => delete track.vis).remove();

        // Dealing with different 'this' scopes without using 'that'
        const appendTrack = (track, node) => {
            if (track.type === 'discrete') this._appendCategoricalTrack(track.key, node);
        };

        svgs.enter().append('svg')
          .each(function (track) {appendTrack(track, d3.select(this));})
          .merge(svgs).attrs({
            class: d => `metaTrack meta_${d.key}`,
            width: this.controller.windowSize.width,
            height: d => (d.type === 'discrete') ? 22 : 5
        });
    }

    _updateVisualizations(visibleTracks) {
        const metaData = this.controller.selectMetaDims;
        visibleTracks.forEach(track => {
            if (track.type === 'discrete') this._updateCategoricalTrack(track, metaData);
        })
    }

    _updateCategoricalTrack(track, metaData) {
        const cm = this.colorManager.scaleForDim(track.key);
        const trackData = metaData[track.key][0];

        track.vis.updateOptions({
            options: {
                pos: {x: 60 - this.controller.cellWidth, y: 1},
                cellWidth: this.controller.cellWidth
            }
        })

        track.vis.update({
            words: trackData,
            colorArray: trackData.map(d => cm(d))
        })
    }


    _appendCategoricalTrack(key, node) {
        node.append('text').attrs({
            class: 'fontAwesome closeButton',
            x: 10,
            y: 11
        }).text('\uf057').on('click', () => this._unuseTrack(key));
        this.availableTracks[key].vis =
          new WordSequence({
              parent: node,
              eventHandler: this.eventHandler,
              options: {
                  pos: {x: 60 - this.controller.cellWidth, y: 1},
                  cellWidth: this.controller.cellWidth,
                  cellHeight:20,
                  mode: WordSequence.modes.simple
              }
          })
    }


    actionCellWidthChange() {
        this._updateVisualizations(this.controller.visibleMeta.map(key => this.availableTracks[key]))
    }

}

LSTMMetaTrackHandler;
