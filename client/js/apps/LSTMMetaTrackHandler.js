/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 2/28/17.
 */
class LSTMMetaTrackHandler {


    constructor({parentNode, controller, eventHandler, globalEventHandler, colorManager, view}) {
        this.visTypes = {
            categorical: 'discrete',
            wordVec: 'wordvec'
        }


        this.parentNode = parentNode;
        this.controller = controller;
        this.eventHandler = eventHandler;
        this.globalEventHandler = globalEventHandler;
        this.colorManager = colorManager;
        this.view = view;

        this.addButton = d3.select('#addMetaTrackBtn');
        this.optionList = d3.select('#addMetaList');
        this.dialog = d3.select('#addMetaDialog');

        this.globalEventHandler.bind(LSTMController.events.projectsMetaAvailable, () => this.init());
        this.globalEventHandler.bind(LSTMController.events.newContextAvailable, () => this._update());

        this.maskOptionButton = d3.select('#selectionMask');

        this.availableTracks = {};
        this.maxLengthWordVec = 5;

    }


    init() {

        const meta = this.controller.projectInfo.meta;

        Object.keys(meta).forEach(key => this.availableTracks[key] = {type: meta[key].vis.type, key});


        this.addButton.on('click', () => {
            const vismeta = this.controller.visibleMeta;
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
          });

        this.maskOptionButton.on("click", () => {
            const m = this.maskOptionButton;
            m.classed('activeOption', !m.classed('activeOption'));
            this._update()
        });

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

        this.selectedCells = this.maskTrack ? this.controller.cellSelection() : [];
        if (this.selectedCells.length > 0) {
            this.selectedCellsHM = this.controller.sumCellValues(this.selectedCells);
        }

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
            if (track.type === this.visTypes.categorical) this._appendCategoricalTrack(track.key, node);
            if (track.type === this.visTypes.wordVec) this._appendWordVecTrack(track.key, node);
        };

        svgs.enter().append('svg')
          .attr('height', d => (d.type === this.visTypes.categorical) ? 22 : 5)
          .each(function (track) {appendTrack(track, d3.select(this));})
          .merge(svgs).attrs({
            class: d => `metaTrack meta_${d.key}`,
            width: this.controller.windowSize.width
        });
    }

    _updateVisualizations(visibleTracks) {
        const metaData = this.controller.selectMetaDims;
        visibleTracks.forEach(track => {
            if (track.type === this.visTypes.categorical) this._updateCategoricalTrack(track, metaData);
            if (track.type === this.visTypes.wordVec) this._updateWordVecTrack(track, metaData);
        })
    }

    _updateCategoricalTrack(track, metaData) {
        const cm = this.colorManager.scaleForDim(track.key);
        const words = metaData[track.key][0];

        track.vis.updateOptions({
            options: {
                pos: {x: this.view.posX, y: 1},
                cellWidth: this.controller.cellWidth
            }
        });

        let colorArray = words.map(d => cm(d));

        // Mask only if there are selected cells AND Masking active
        const mask = this.selectedCells.length > 0;

        if (mask) {
            const maskHM = this.selectedCellsHM;

            const maskScale = d3.scaleLinear().domain([0, d3.max(maskHM)]).range([0.2, 1]);

            colorArray = colorArray.map((d, i) => {
                const col = d3.color(d);
                col.opacity = maskScale(maskHM[i]);

                return col;
            })
        }


        track.vis.update({
            words,
            colorArray,
            leftPadding: this.controller.ctxLeftPadding
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
                  pos: {x: this.view.posX, y: 1},
                  cellWidth: this.controller.cellWidth,
                  cellHeight: 20,
                  mode: WordSequence.modes.simple
              }
          })
    }


    actionCellWidthChange() {
        this._updateVisualizations(this.controller.visibleMeta.map(key => this.availableTracks[key]))
    }

    actionUpdateAll() {
        this._update();
    }

    _appendWordVecTrack(key, node) {
        node.append('text').attrs({
            class: 'fontAwesome closeButton',
            x: 10,
            y: 11
        }).text('\uf057').on('click', () => this._unuseTrack(key));

        const ml = this.maxLengthWordVec;

        node.attr('height', ml * 22 + 2);
        const allVis = [];
        for (const i of _.range(0, ml)) {
            allVis.push(
              new WordSequence({
                  parent: node,
                  eventHandler: this.eventHandler,
                  options: {
                      pos: {x: this.view.posX, y: 1 + i * 22},
                      cellWidth: this.controller.cellWidth,
                      cellHeight: 20,
                      mode: WordSequence.modes.simple
                  }
              }))
        }
        this.availableTracks[key].vis = allVis;

    }

    _updateWordVecTrack(track, metaData) {
        const allVis = this.availableTracks[track.key].vis;
        const trackData = metaData[track.key];

        const has_words = 'words' in trackData && trackData.words[0].length > 0;
        const has_weights = 'weights' in trackData && trackData.weights[0].length > 0


        if (has_words) {
            const wordVecs = Util.transpose(trackData.words[0]);
            let weights = []
            let colorScales = null;
            if (has_weights) {
                const percolumn = trackData.weights[0];
                weights = Util.transpose(percolumn);
                const cm = new ColorManager({});
                colorScales = percolumn.map(d => cm.dynamicScalarScale(d));
            }


            const maxWords = Math.min(this.maxLengthWordVec, wordVecs[0].length);

            _.range(0, maxWords).forEach(i => {

                allVis[i].updateOptions({
                    options: {
                        pos: {x: this.view.posX, y: 1 + i * 22},
                        cellWidth: this.controller.cellWidth
                    }
                })

                const updateValues = {
                    words: wordVecs[i],
                    leftPadding: this.controller.ctxLeftPadding
                };
                if (has_weights) {
                    updateValues.colorArray = weights[i].map((d, di) => colorScales[di](d))
                }

                allVis[i].update(updateValues);

            })


        }

    }

    get maskTrack() {
        return this.maskOptionButton.classed('activeOption');
    }


}

LSTMMetaTrackHandler;
