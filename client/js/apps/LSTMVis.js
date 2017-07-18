/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 1/25/17.
 */
class LSTMVis {

    constructor() {
        this.globalEventHandler = new SimpleEventHandler(d3.select('body').node());
        this.controller = new LSTMController({eventHandler: this.globalEventHandler});

        this.selectionView = new LSTMSelectionView({
            controller: this.controller,
            globalEventHandler: this.globalEventHandler
        });

        this.matchView = new LSTMMatchView({
            controller: this.controller,
            globalEventHandler: this.globalEventHandler
        });

        this.dialogHandler = new LSTMDialogHandler({
            controller: this.controller,
            eventHandler: this.globalEventHandler
        });


        this.bindGlobalEvents();

        this.controller.initByUrlAndRun();
    }


    bindGlobalEvents() {

        this.globalEventHandler.bind(LSTMController.events.windowResize, () => {
            const newWidth = this.controller.windowSize.width;
            this.selectionView.actionUpdateWidth(newWidth);
            this.matchView.actionUpdateWidth(newWidth);
        });

        // --------------------------------
        // -- Shrink/Expand Cell Width---
        // --------------------------------

        d3.select('#smaller_btn').on('click', () => {
            this.controller.cellWidth = Math.max(5, this.controller.cellWidth - 5);
            this.selectionView.actionUpdateCellWidth();
            this.matchView.actionUpdateCellWidth();
        });

        d3.select('#larger_btn').on('click', () => {
            this.controller.cellWidth = this.controller.cellWidth + 5;
            this.selectionView.actionUpdateCellWidth();
            this.matchView.actionUpdateCellWidth();
        });


        d3.select('#info_position').on('click',
          () => this.dialogHandler.openPositionDialog());

        d3.select('#info_source').on('click',
          () => this.dialogHandler.openSourceDialog());


        this.globalEventHandler.bind(LSTMController.events.newContextAvailable,
          () => this.actionUpdateGlobalInfos())

    }

    actionUpdateGlobalInfos() {
        const pi = this.controller.projectInfo;
        d3.select('#info_position').text(this.controller.pos);
        d3.select('#info_projectName').text(pi.name);
        d3.select('#info_id').text(this.controller.projectID);
        d3.select('#info_source').text(this.controller.source);
    }

}

const lstmVis = new LSTMVis();

lstmVis;
