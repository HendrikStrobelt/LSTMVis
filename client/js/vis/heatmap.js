class HeatMap extends VComponent {

    /** @namespace this.layers.guiPanel */

    static get events() {
        return {
            cellHovered: 'heatmap-cellHovered',
            rectSelected: 'heatmap-rectSelected',
            circleSelected: 'heatmap-circleSelected',
            closeWindow: 'heatmap-closeWindow'
        }
    }

    get defaultOptions() {
        return {
            pos: {x: 30, y: 50},
            title: "Heatmap",
            key: '',
            // Width and height of one HM cell
            cellWidth: 10,
            cellHeight: 20,
            // Defines if heatmap shows scalar or categorical data
            chartType: HeatMap.chartType.scalar,
            // D3 color scale or 'null' if using automatic min-max scale
            ownColorScale: null,
            colorManager: new ColorManager({})
        }
    }

    get layout() {
        return [
            // {name: 'bg', pos: {x: 0, y: 0}},
            {name: 'title', pos: {x: 30, y: -20 + 12}},
            {name: 'guiPanel', pos: {x: 0, y: -20}},
            {name: 'cells', pos: {x: 0, y: 0}},
            {name: 'hmTooltip', pos: {x: 5, y: 50}},
        ];

    }

    // Data Style
    get _dataFormat() {
        return {
            values: null,
            labels: null,
            opacity: []
        }
    }

    static get chartType() {
        return {
            scalar: 1,
            categorical: 2
        }
    }

    // INIT METHODS
    _init() {

        this._initDecoration();
        this._initTooltip();
    }

    _initDecoration() {
        // Put title above.
        this.layers.title.append('text')
          .text(this.options.title).attr('class', 'noselect').attr('pointer-events', 'none');

        // Add buttons
        const select = (e, button) => () =>
          this.eventHandler.trigger(e, button.classed('selected') ? 'none' : this.id);
        const width = 12;
        const height = 12;
        const y = 1;
        const x = [0, 15];
        const rect_button = this.layers.guiPanel.append('rect');
        rect_button.attrs({
            class: 'mapping-rect-button',
            x: x[0],
            y, width, height
        }).on('click', select(HeatMap.events.rectSelected, rect_button));

        // const circle_button = this.layers.guiPanel.append('circle')
        // circle_button.attrs({
        //     class: 'mapping-circle-button',
        //     cx: x[1] + width / 2,
        //     cy: y + width / 2,
        //     r: width / 2
        // }).on('click', select(HeatMap.events.circleSelected, circle_button));

        this.layers.guiPanel.append('text').attrs({
            class: 'mapping-hide-button noselect',
            y: y + height / 2,
            x: 100
        }).text('\uf05c').on('click',
          () => this.eventHandler.trigger(HeatMap.events.closeWindow, this));

    }

    _initTooltip() {
        this.layers.hmTooltip.attr('opacity', 0);
        // Setup the hover tool tip.
        this.layers.hmTooltip.append('rect').attrs({
            x: -50,
            y: 0,
            width: 100,
            height: 15
        });
        this.layers.hmTooltip.append('text').attrs({
            x: 0,
            y: 13
        }).text('Hallo')
    }

    // RENDER/WRANGLE METHODS
    _wrangle(data) {
        const op = this.options;

        let colorScale = op.ownColorScale;
        // If no own color scale given, create one
        if (op.ownColorScale == undefined) {

            if (op.chartType == HeatMap.chartType.scalar) {
                colorScale =
                  op.colorManager.scaleForDim(op.key) ||
                  op.colorManager.dynamicScalarScale(_.flatten(data.values));

            } else if (op.chartType == HeatMap.chartType.categorical) {
                colorScale =
                  op.colorManager.scaleForDim(op.key) ||
                  op.colorManager.dynamicCategoricalScale(_.flatten(data.values));
            }
        }

        // Make the data.
        let labelFormat = d3.format(".4f");
        if (!_.isNumber(data.values[0][0])) labelFormat = _.identity;
        let label = (x, y, v) => { return {row: x, col: y, label: data.labels[x][y], value: v};};
        if (!data.labels) {
            label = (x, y, v) => { return {row: x, col: y, label: labelFormat(v), value: v};};
        }

        this._states.xLength = data.values[0].length;
        this._states.yLength = data.values.length;

        // Return the renderData.
        return {
            opacity: data.opacity || [],
            colorScale: colorScale,
            raw: _.flatten(data.values.map((row, x) => row.map((value, y) => label(x, y, value))))
        };
    }

    _render(renderData) {

        // Build the scales.
        this.scaleY = d3.scaleLinear()
          .domain([0, 1])
          .range([0, this.options.cellHeight]);
        this.scaleX = d3.scaleLinear()
          .domain([0, 1])
          .range([0, this.options.cellWidth]);

        this.layers.guiPanel.select('.mapping-hide-button')
          .attr('x', this.currentWidth - 12);

        const width = this.scaleX(1) - this.scaleX(0);
        const height = this.scaleY(1) - this.scaleY(0);

        // Create a heat map cell
        const hmCell = this.layers.cells.selectAll(".cell").data(renderData.raw);
        hmCell.exit().remove();
        const hmUpdate = hmCell.enter().append("rect").merge(hmCell);

        const hasOpacity = renderData.opacity.length > 0 && this.options.chartType != this.chartType.scalar;
        const hover = active => d =>
          this.eventHandler.trigger(HeatMap.events.cellHovered,
            {col: d.col, row: d.row, active: active});
        hmUpdate.attrs({
            "class": d => "cell x" + d.col + " y" + d.row,
            x: d => this.scaleX(d.col),
            y: d => this.scaleY(d.row),
            width,
            height
        })
          .styles({
              fill: d => renderData.colorScale(d.value),
              opacity: d => (hasOpacity) ? renderData.opacity[d.col][d.row] : null
          })
          .on('mouseover', hover(true))
          .on('mouseout', hover(false));
    }

    // ACTION METHODS
    actionHoverCell(x, y, select) {
        const hovered = this.layers.cells.selectAll(".x" + x + ".y" + y);
        hovered.classed('hovered', select);
        if (select) {
            const datum = hovered.datum();
            this.layers.hmTooltip.attrs({
                opacity: 1,
                "transform": SVG.translate({
                    x: this.scaleX(datum.col),
                    y: this.scaleY(datum.row + 1) + 5
                })
            }).select('text').text(datum.label);
        } else {
            this.layers.hmTooltip.attrs({opacity: 0});
        }
    }

    actionRectSelect(idSet) {
        this.layers.guiPanel.selectAll('.mapping-rect-button')
          .classed('selected', idSet.has(this.id));
    }

    actionCircleSelect(idSet) {
        this.layers.guiPanel.selectAll('.mapping-circle-button')
          .classed('selected', idSet.has(this.id));
    }

    actionSetPos(pos) {
        this.options.pos = pos;
        this.base.transition().attr('transform', SVG.translate(pos))
    }


    get currentWidth() {
        if (!this.scaleX) return 0;

        return this.scaleX(this._states.xLength)
    }

    get currentHeight() {
        return this.scaleY(this._states.yLength)
    }

    _bindLocalEvents(handler) {
        this._bindEvent(handler, HeatMap.events.cellHovered,
          data => this.actionHoverCell(data.col, data.row, data.active));

        this._bindEvent(handler, HeatMap.events.rectSelected,
          hm_id => this.actionRectSelect(new Set([hm_id])));

        this._bindEvent(handler, HeatMap.events.circleSelected,
          hm_id => this.actionCircleSelect(new Set([hm_id])));

        this._bindEvent(handler, HeatMap.events.closeWindow,
          hm => {
              if (this.id === hm.id) this.hideView();
          }
        )

    }
}

HeatMap;
