/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 1/25/17.
 */
class LSTMVis {

    constructor() {
        this.querySVG = d3.select('#queryVis');
        this.querySVGCells = d3.select('#queryVisCells');
        this.resultSVG = d3.select('#resultVis');
        this.eventHandler = new SimpleEventHandler(this.querySVG.node());
        this.controller = new LSTMController({eventHandler: this.eventHandler});
        this.hmHandler = new LSTMHeatmapHandler({
            parentNode: this.resultSVG,
            controller: this.controller,
            eventHandler: this.eventHandler
        })


        this.setupQuery();
        this.setupResult();

        this.bindDataEvents();
        this.bindUIEvents();
        this.bindHoverEvents();

        this.controller.initByUrlAndRun();
    }

    setupQuery() {

        this.querySVG.attr('width', this.controller.windowSize.width);

        this.lineplot = new LinePlot({
            parent: this.querySVG, eventHandler: this.eventHandler,
            options: {
                cellWidth: this.controller.cellWidth,
                height: 200,
                pos: {x: 0, y: 5},
                globalExclusiveEvents: [LinePlot.events.cellHovered]
            }
        });

        this.wordSequence = new WordSequence({
            parent: this.querySVG, eventHandler: this.eventHandler,
            options: {
                cellWidth: this.controller.cellWidth,
                pos: {x: 60 - this.controller.cellWidth, y: 210 + 5}
            }
        });

        this.cellList = new CellList({
            parent: this.querySVGCells, eventHandler: this.eventHandler,
            options: {
                pos: {x: 0, y: 0},
                globalExclusiveEvents: [CellList.events.cellHovered]
            }
        })


    }

    setupResult() {
        this.resultSVG
          .attr('width', this.controller.windowSize.width)
          .attr('opacity', 0);

        this.wordMatrix = new WordMatrix({
            parent: this.resultSVG, eventHandler: this.eventHandler,
            options: {
                cellWidth: this.controller.cellWidth,
                pos: {x: 10, y: 20}
            }
        });

        this.hmHandler.init();
    }

    bindDataEvents() {
        this.eventHandler.bind(LSTMController.events.newContextAvailable,
          () => {
              const states = this.controller.states;
              const timeSteps = states.right - states.left;

              const cellValues = states.data.map(
                (values, index) => ({values, index})
              );

              this.lineplot.update({timeSteps, cellValues});
              this.lineplot.actionUpdateThreshold(this.controller.threshold);


              this.wordSequence.update({
                  words: this.controller.words.words,
                  wordBrush: this.controller.wordBrush,
                  wordBrushZero: this.controller.wordBrushZero
              });

              this.updateCellSelection();
              this.hmHandler.updateMetaOptions();


          });


        this.eventHandler.bind(LSTMController.events.newMatchingResults, () => {
            const wordMatrix = this.controller.matchingWordMatrix;
            wordMatrix.forEach(row => {
                row.posOffset = row.left;
                row.rowId = row.pos;
            });
            this.hmHandler.updateHeatmapData();

            this.wordMatrix.update({wordMatrix});

            this.resultSVG.transition().attr('opacity', 1);
        })

    }


    updateCellSelection(recalc = false) {
        const cellSelection = this.controller.cellSelection(recalc);
        this.lineplot.actionUpdateSelectedCells(cellSelection);

        if (cellSelection.length == 0) {
            this.wordSequence.actionChangeWordBackgrounds(null)
            this.cellList.update({cells: []})
        } else {
            const sumVec = this.controller.sumCellValues(cellSelection);
            const cScale = d3.scaleLinear().domain([0, d3.max(sumVec)]).range(['white', '#1399e4']);

            this.wordSequence.actionChangeWordBackgrounds(sumVec.map(v => cScale(v)))
            this.cellList.update({cells: cellSelection})
        }


    }

    bindUIEvents() {
        const cellWidthUpdate = () => {
            this.lineplot.updateOptions({
                options: {cellWidth: this.controller.cellWidth},
                reRender: true
            });

            this.wordSequence.updateOptions({
                options: {cellWidth: this.controller.cellWidth},
                reRender: true
            });
            this.wordSequence.base.attr('transform', `translate(${60 - this.controller.cellWidth},215)`)

            this.wordMatrix.updateOptions({
                options: {cellWidth: this.controller.cellWidth},
                reRender: true
            });
        };


        d3.select('#smaller_btn').on('click', () => {
            this.controller.cellWidth = Math.max(5, this.controller.cellWidth - 5);
            cellWidthUpdate()
        });
        d3.select('#larger_btn').on('click', () => {
            this.controller.cellWidth = this.controller.cellWidth + 5;
            cellWidthUpdate()
        });

        d3.select('#match_precise').on('click',
          () => {
              this.resultSVG.transition().attr('opacity', 0);

              this.controller.requestMatch({
                  metaDims: [...Object.keys(this.controller.projectMetadata.meta)],
                  mode: 'precise'
              })
          });

        d3.select('#match_fast').on('click',
          () => {
              this.resultSVG.transition().attr('opacity', 0);
              this.controller.requestMatch({
                  metaDims: [...Object.keys(this.controller.projectMetadata.meta)],
                  mode: 'fast'
              })
          });
        // --------------------------------
        // -- Move Position ---
        // --------------------------------


        const modifyPos = offset => {
            const oldBrush = this.controller.wordBrush;
            if (oldBrush) {
                this.controller.wordBrush = [oldBrush[0] - offset, oldBrush[1] - offset]
            }
            this.controller.pos = this.controller.pos + offset;
            this.controller.requestContext({});
        }

        d3.select('#inc_pos').on('click', () => {
            modifyPos(+5);
        });
        d3.select('#dec_pos').on('click', () => {
            modifyPos(-5);
        });


        // --------------------------------
        // -- Brush Events and Handling ---
        // --------------------------------


        this.eventHandler.bind(WordSequence.events.brushSelectionChanged,
          sel => {
              this.controller.wordBrush = sel;
              this.updateCellSelection(true);
          }
        );

        this.eventHandler.bind(WordSequence.events.zeroBrushSelectionChanged,
          sel => {
              this.controller.wordBrushZero = sel;
              this.updateCellSelection(true);
          }
        );

        this.eventHandler.bind(LinePlot.events.thresholdChanged, th => {
              this.controller.threshold = Util.round(th.newValue, 4);
              this.updateCellSelection(true);
          }
        )

        this.eventHandler.bind(LSTMController.events.windowResize, () => {
            const newWidth = this.controller.windowSize.width;
            this.querySVG.attr('width', newWidth);
            this.resultSVG.attr('width', newWidth);
        })

        d3.select('#addMetaTrackBtn').on('click', () => {
            console.log(this.controller.projectMetadata.meta);

            const metaKeys = Object.keys(this.controller.projectMetadata.meta)
            const metaOps = d3.select('#addMetaList').selectAll('option').data(metaKeys)
            metaOps.exit().remove()
            metaOps.enter().append('option')
              .merge(metaOps).attr('value', d => d).text(d => d)

            ModalDialog.open({
                rootNode: d3.select('#addMetaDialog'),
                eventHandler: this.eventHandler
            })
        })

        this.eventHandler.bind(ModalDialog.events.modalDialogSubmitted,
          node => {

              console.log(node.attr('id'));
          }
        )


    }

    bindHoverEvents() {
        this.eventHandler.bind(
          [CellList.events.cellHovered, LinePlot.events.cellHovered].join(' '),
          d => {
              this.lineplot.actionCellHovered(d.index);
              this.cellList.actionCellHovered(d.index);
          })

        this.eventHandler.bind(
          [WordMatrix.events.cellHovered, HeatMap.events.cellHovered].join(' '),
          d => {
              this.wordMatrix.actionCellHovered(d.row, d.col, d.active);
              this.hmHandler.actionCellHovered(d.row, d.col, d.active);
          })

        this.eventHandler.bind(
          HeatMap.events.rectSelected,
          hm_id => {
              const heatmap = this.hmHandler.getHeatmapById(hm_id);
              if (heatmap) {
                  const colorScale = heatmap.renderData.colorScale;
                  const colorMap = heatmap.data.values
                    .map(row => row.map(cell => colorScale(cell)));
                  this.wordMatrix.actionChangeHeatmap(colorMap)
              } else {
                  this.wordMatrix.actionChangeHeatmap(null);
              }

          }
        )

    }

}

const lstmVis = new LSTMVis();

lstmVis;
