/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 3/8/17.
 */
class LSTMMatchView {

    constructor({controller, globalEventHandler}) {
        this.controller = controller;
        this.globalEventHandler = globalEventHandler;

        this.matchingSVG = d3.select('#matchingVis');
        this.localEventHandler = new SimpleEventHandler(this.matchingSVG.node());

        this.hmHandler = new LSTMHeatmapHandler({
            parentNode: this.matchingSVG,
            controller: this.controller,
            eventHandler: this.localEventHandler,
            colorManager: this.controller.colorManager,
            globalEventHandler
        });

        this._initView();

        this._bindDataEvents();
        this._bindUIEvents();

    }

    _initView() {
        this.matchingSVG
          .attr('width', this.controller.windowSize.width)
          .attr('opacity', 0);

        this.wordMatrix = new WordMatrix({
            parent: this.matchingSVG, eventHandler: this.localEventHandler,
            options: {
                cellWidth: this.controller.cellWidth,
                pos: {x: 35, y: 20}
            }
        });

        this.resultLinkPanel = new ButtonMatrix({
            parent: this.matchingSVG, eventHandler: this.localEventHandler,
            options: {
                cellWidth: 25,
                cellHeight: 20,
                pos: {x: 5, y: 20},
                additionalClasses: 'fontAwesome',
                buttonText: '\uf08e'
            }
        })

        this.hmHandler.init();
    }

    _bindDataEvents() {
        this.globalEventHandler.bind(
          LSTMController.events.newMatchingResults,
          () => this.actionNewMatchResult())

        this.globalEventHandler.bind(
          LSTMController.events.newContextAvailable,
          () => this.hmHandler.updateMetaOptions()
        )

    }

    _bindUIEvents() {
        d3.select('#match_precise').on('click', () => {
            this.matchingSVG.transition().attr('opacity', 0);
            this.controller.requestMatch({
                metaDims: [...Object.keys(this.controller.projectInfo.meta)],
                mode: 'precise'
            })
        });

        d3.select('#match_fast').on('click', () => {
            this.matchingSVG.transition().attr('opacity', 0);
            this.controller.requestMatch({
                metaDims: [...Object.keys(this.controller.projectInfo.meta)],
                mode: 'fast'
            })
        });


        this.localEventHandler.bind(LSTMHeatmapHandler.events.newMappedHM,
          () => {
              this.wordMatrix.actionChangeHeatmap(this.hmHandler.bgColorMap)
          });

        // --------------------------------
        // -- Hover Events ---
        // --------------------------------


        this.localEventHandler.bind(
          [WordMatrix.events.cellHovered, HeatMap.events.cellHovered].join(' '),
          d => {
              this.wordMatrix.actionCellHovered(d.row, d.col, d.active);
              this.hmHandler.actionCellHovered(d.row, d.col, d.active);
          });


        this.localEventHandler.bind(ButtonMatrix.events.buttonClicked,
          ({caller, value}) => {
              if (caller === this.resultLinkPanel) {
                  const nls = this.controller.newLinkString({
                      overwrite: {pos: value},
                      ignore: ['wordBrush', 'wordBrushZero']
                  });
                 window.open(nls, '_blank');
              }
          })

    }

    actionNewMatchResult() {
        const wordMatrix = this.controller.matchingWordMatrix;
        wordMatrix.forEach(row => {
            row.posOffset = row.left;
            row.rowId = row.pos;
        });
        this.hmHandler.updateHeatmapData();

        this.resultLinkPanel.update(wordMatrix.map(d => [d.pos]))

        this.wordMatrix.update({
            wordMatrix,
            heatmap: this.hmHandler.bgColorMap,
            leftPadding: this.controller.matchingLeftPadding
        });

        this.matchingSVG.transition().attr('opacity', 1);
    }

    actionUpdateCellWidth() {
        const cellWidth = this.controller.cellWidth;
        this.wordMatrix.updateOptions({
            options: {cellWidth},
            reRender: true
        });
    }

    actionUpdateWidth(width) {
        this.matchingSVG.attr('width', width);
    }

}

LSTMMatchView;
