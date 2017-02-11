/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 1/25/17.
 */
class LSTMController {

    static get events() {
        return {
            wrongParameters: 'lstmcontroller_wrongParams',
            contextRequestSent: 'lstmcontrol_ctxreq',
            newContextAvailable: 'lstmcontrol_newctx',
            newMatchingResults: 'lstmcontrol_newmatch'
        }
    }

    /**
     * Parameters not visible in URL
     * @returns {Set} the set of params
     */
    static get hiddenParams() {
        return new Set(['dims', 'transform', 'left', 'right'])
    }


    constructor({eventHandler}) {
        this.apiURL = URLHandler.basicURL() + '/api/v2';
        this.eventHandler = eventHandler;
        this.state = {};


        this.params = URLHandler.parameters();
        this._setContextDefaults(this.params);
        this.updateURLparams();

    }

    updateURLparams() {
        const validParams = new Map([...this.params]
          .filter(d => !LSTMController.hiddenParams.has(d[0])));


        URLHandler.updateUrl({
            urlParameters: validParams,
            addToBrowserHistory: false
        })
    }

    initByUrlAndRun() {
        const params = this.params;

        if (
          params.has('project') &&
          params.has('pos') &&
          params.has('source')) {

            Network.ajax_request(this.apiURL + '/info')
              .get()
              .then(response => {
                  const allProjects = JSON.parse(response);
                  this.allProjectInfos = new Map();
                  allProjects.forEach(d => this.allProjectInfos.set(d.project, d))
                  this.requestContext({});

              })


        } else {
            this.eventHandler.trigger(LSTMController.events.wrongParameters, params);
        }
    }

    _setContextDefaults(params) {
        const sd = (att, def) => params.set(att, params.get(att) || def);
        sd('left', 5);
        sd('right', 40);
        sd('dims', ['states', 'words']);
        sd('activation', 0.3);
        sd('cw', 30);

    }

    requestContext({params = {}, persist = true}) {

        const parMap = Util.objectMap(params);
        const payload = new Map();
        const parameterNames =
          ['project', 'pos', 'source', 'left', 'right', 'dims', 'activation'];

        parameterNames.forEach(pName => payload.set(pName,
          (parMap.get(pName) || this.params.get(pName))));

        if (persist) {
            parameterNames.forEach(pName => {
                if (parMap.has(pName)) this.params.set(pName, parMap.get(pName))
            });
            this.updateURLparams();
        }


        Network.ajax_request(this.apiURL + '/context')
          .get(payload)
          .then(d => {
              this.context = JSON.parse(d);
              this.eventHandler.trigger(LSTMController.events.newContextAvailable, {});
          })

    }

    requestMatch({metaDims = [], mode = 'fast'}) {
        const matchPayload = new Map();
        const matchParameters =
          ['project', 'source', 'activation', 'left', 'right'];

        if (this.state.selectedCells && this.state.selectedCells.length > 0) {
            matchParameters.forEach(pName => matchPayload.set(pName, this.params.get(pName)));
            matchPayload.set('cells', this.state.selectedCells.join(','));
            matchPayload.set('constraints', this.params.get('wordBrushZero').join(','));
            matchPayload.set('dims', [...metaDims, 'states', 'cell_count', 'words']);
            matchPayload.set('mode', mode);

            Network.ajax_request(this.apiURL + '/match')
              .get(matchPayload)
              .then(matchResponse => {
                  this.matchResult = JSON.parse(matchResponse);

                  console.log(this.matchResult, '\n-- matchResult --');
                  this.eventHandler.trigger(LSTMController.events.newMatchingResults, {});

              })
        }


    }


    get matchingWordMatrix() {
        return this.matchResult.results.positionDetail.words
    }


    set wordBrush(range) {
        this.params.set('wordBrush', range);
        if (!range) this.params.set('wordBrushZero', null);
        else if (!this.params.get('wordBrushZero')) this.params.set('wordBrushZero', [1, 0]);
        this.updateURLparams();


    }

    get wordBrush() {
        return this.params.get('wordBrush');
    }


    set wordBrushZero(range) {
        this.params.set('wordBrushZero', range);
        this.updateURLparams();
    }

    get wordBrushZero() {
        return this.params.get('wordBrushZero');
    }


    get states() {
        return this.context.results.states[0];
    }

    get words() {
        return this.context.results.words[0]
    }

    get threshold() {
        return this.params.get('activation')
    }

    set threshold(value) {
        this.params.set('activation', value);
        this.updateURLparams();
    }

    get pos() {
        return this.params.get('pos');
    }

    set pos(p) {
        return this.params.set('pos', p);
    }

    get projectMetadata() {
        return this.allProjectInfos.get(this.params.get('project')).info
    }

    get cellWidth() {
        return this.params.get('cw');
    }

    set cellWidth(w) {
        this.params.set('cw', w);
        this.updateURLparams();
    }


    cellSelection(recalc = false) {
        if (!('selectedCells' in this.state)) {
            this.state.selectedCells = this.params.get('sc') || [];
        }

        if (recalc) {
            if (this.wordBrush && this.wordBrushZero) {
                const threshold = this.threshold;
                const cellValues = this.states.data;

                const leftBound = this.wordBrush[0] - this.wordBrushZero[0];
                const rightBound = this.wordBrush[1] + this.wordBrushZero[1];

                const signature = Util.range(leftBound, rightBound)
                  .map(v => (v >= this.wordBrush[0] && v < this.wordBrush[1]) ? 1 : 0)
                  .join('')

                this.state.selectedCells = [];

                cellValues.forEach((cellVector, index) => {
                    const testSig = cellVector.slice(leftBound, rightBound)
                      .map(v => (v >= threshold) ? 1 : 0)
                      .join('');
                    if (testSig === signature) this.state.selectedCells.push(index);

                })


            } else {
                this.state.selectedCells = []
            }

        }

        if (this.state.selectedCells.length > 0) {
            this.params.set('sc', this.state.selectedCells)
        } else {
            this.params.delete('sc')
        }

        this.updateURLparams();

        return this.state.selectedCells;

    }

    sumCellValues(selectedCells) {
        const testMap = new Set(selectedCells);
        const threshold = this.threshold;
        const cellValues = this.states.data.filter((d, i) => testMap.has(i));


        const sumVector = cellValues[0].map(() => 0);
        cellValues.forEach(vector =>
          vector.forEach((v, i) =>
            sumVector[i] += (v >= threshold) ? 1 : 0))

        return sumVector;
    }


}

LSTMController;
