/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 3/3/17.
 */

class LSTMDialogHandler {

    constructor({controller, eventHandler}) {
        this.controller = controller;
        this.eventHandler = eventHandler;

        this.positionDialog = d3.select('#positionDialog');
        this.pd_pos = d3.select('#pd_pos');

        this.pd_search = d3.select('#pd_search');
        this.pd_search.on('change', () => this._startSearch());
        this.pd_results = d3.select('#pd_results');


        this.sourceDialog = d3.select('#selectSourceDialog');
        this.ssd_list = d3.select('#ssd_list');

        this._bindEvents()
    }

    openPositionDialog() {
        this.pd_pos.property('value', this.controller.pos);


        ModalDialog.open({
            rootNode: this.positionDialog,
            eventHandler: this.eventHandler,
            width: 400
        })

    }

    openSourceDialog() {
        const allOptions = this.ssd_list.selectAll('option').data(this.controller.availableSources)
        allOptions.exit().remove();

        allOptions.enter().append('option').merge(allOptions).attrs({
            value: d => d
        }).text(d => d)

        ModalDialog.open({
            rootNode: this.sourceDialog,
            eventHandler: this.eventHandler,
            width: 300
        })

    }


    _bindEvents() {
        this.eventHandler.bind(ModalDialog.events.modalDialogSubmitted,
          d => {
              if (d === this.positionDialog) {
                  this._positionDialogSubmitted();
              }
              if (d === this.sourceDialog) {
                  this._sourceDialogSubmitted();
              }


          })


        this.eventHandler.bind(LSTMController.events.newWordSearchResults, () => {
            const results = this.controller.wordSearchResult.res;

            const pd_results = this.pd_results.selectAll('.pd_result').data(results);
            pd_results.exit().remove();

            pd_results.enter().append('div').attr('class', 'pd_result')
              .merge(pd_results).html(d => d.text)
              .on('click', d => {
                  this.pd_pos.property('value', d.index);
                  this._positionDialogSubmitted();
              });

        })

    }

    _positionDialogSubmitted() {
        this.controller.pos = Number(this.pd_pos.property('value'));
        ModalDialog.close({rootNode: this.positionDialog});
        this.controller.requestContext({});
    }


    _startSearch() {
        const searchTerm = this.pd_search.property('value');

        this.controller.requestWordSearch({searchTerm});


    }

    _sourceDialogSubmitted() {
        const source = this.ssd_list.property('value');
        ModalDialog.close({rootNode: this.sourceDialog});
        this.controller.requestContext({params: {source}, keepSelectedCells: false});

    }
}

LSTMDialogHandler;