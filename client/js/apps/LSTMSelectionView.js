/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 3/8/17.
 */

class LSTMSelectionView {

    constructor({controller, globalEventHandler}) {
        this.controller = controller;
        this.globalEventHandler = globalEventHandler;


        this.selectionSVG = d3.select('#selectionVis');
        this.selectedCellsSVG = d3.select('#selectedCellsVis');
        this.thresholdForm = d3.select('#thresholdValue');

        this.localEventHandler = new SimpleEventHandler(this.selectionSVG.node());

        this.metaHandler = new LSTMMetaTrackHandler({
            parentNode: d3.select('#metaTracks'),
            controller: this.controller,
            eventHandler: this.localEventHandler,
            globalEventHandler: this.globalEventHandler,
            colorManager: this.controller.colorManager,
            view: this
        });

        // Throttling to stay responsive
        this.updateCellSelection = _.throttle(this._updateCellSelection, 200);


        this._initView();
        this._bindDataEvents();
        this._bindUIEvents();
    }

    _initView() {

        this.selectionSVG.attr('width', this.controller.windowSize.width);

        this.lineplot = new LinePlot({
            parent: this.selectionSVG, eventHandler: this.localEventHandler,
            options: {
                cellWidth: this.controller.cellWidth,
                height: 200,
                pos: {x: 0, y: 5},
                globalExclusiveEvents: [LinePlot.events.cellHovered]
            }
        });

        this.wordSequence = new WordSequence({
            parent: this.selectionSVG, eventHandler: this.localEventHandler,
            options: {
                cellWidth: this.controller.cellWidth,
                pos: {x: this.posX, y: 210 + 5}
            }
        });

        this.cellList = new CellList({
            parent: this.selectedCellsSVG, eventHandler: this.localEventHandler,
            options: {
                pos: {x: 0, y: 0},
                globalExclusiveEvents: [CellList.events.cellHovered]
            }
        })

        this.thresholdForm.property('value', this.controller.threshold);


    }

    _bindDataEvents() {
        this.globalEventHandler.bind(
          LSTMController.events.newContextAvailable,
          d => this.actionNewContext(d));

        this.localEventHandler.bind(LinePlot.events.moreContext,
          () => this.controller.requestContext({}));

    }

    _bindUIEvents() {

        // --------------------------------
        // -- Move Position ---
        // --------------------------------

        d3.select('#inc_pos').on('click', () => {
            this.actionModifyPosition(+5);
        });
        d3.select('#dec_pos').on('click', () => {
            this.actionModifyPosition(-5);
        });

        // --------------------------------
        // -- Brush and Threshold Updates---
        // --------------------------------

        this.localEventHandler.bind(WordSequence.events.brushSelectionChanged,
          sel => {
              this.controller.wordBrush = sel;
              this.updateCellSelection(true);
          }
        );

        this.localEventHandler.bind(WordSequence.events.zeroBrushSelectionChanged,
          sel => {
              this.controller.wordBrushZero = sel;
              this.updateCellSelection(true);
          }
        );

        this.localEventHandler.bind(LinePlot.events.thresholdChanged, th => {
              this.controller.threshold = th.newValue;
              this.thresholdForm.property('value', th.newValue);
              this.updateCellSelection(true);
          }
        );

        this.thresholdForm.on('change', () => {
            const newValue = this.thresholdForm.property('value');
            this.localEventHandler.trigger(LinePlot.events.thresholdChanged, {newValue});
        });

        // --------------------------------
        // -- Hover Events ---
        // --------------------------------

        this.localEventHandler.bind(
          [CellList.events.cellHovered, LinePlot.events.cellHovered].join(' '),
          d => {
              this.lineplot.actionCellHovered(d.index);
              this.cellList.actionCellHovered(d.index);
          })

    }

    _updateCellSelection(recalc = false) {
        const cellSelection = this.controller.cellSelection(recalc);
        this.lineplot.actionUpdateSelectedCells(cellSelection);

        this.metaHandler.actionUpdateAll();

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

    get posX() {
        return Math.round(60 - this.controller.cellWidth / 2);
    }

    actionNewContext({keepSelectedCells}) {

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
            wordBrushZero: this.controller.wordBrushZero,
            leftPadding: this.controller.ctxLeftPadding
        });

        this.updateCellSelection(!keepSelectedCells);


    }

    actionUpdateCellWidth() {
        const cellWidth = this.controller.cellWidth;
        this.lineplot.updateOptions({
            options: {cellWidth},
            reRender: true
        });

        this.wordSequence.updateOptions({
            options: {cellWidth, pos: {x: this.posX, y: 215}},
            reRender: true
        });

        this.metaHandler.actionCellWidthChange();


    }

    actionModifyPosition(offset) {
        const oldBrush = this.controller.wordBrush;
        if (oldBrush) {
            this.controller.wordBrush = [oldBrush[0] - offset, oldBrush[1] - offset]
        }
        this.controller.pos = this.controller.pos + offset;
        this.controller.requestContext({});
    }

    actionUpdateWidth(width) {
        this.selectionSVG.attr('width', width);
    }
}

LSTMSelectionView;
