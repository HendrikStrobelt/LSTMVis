class HeatMapComponent extends VComponent {

    get events() {
        return {
            cellHovered: 'heatmap-cellHovered',
            rectSelected: 'heatmap-rectSelected',
            circleSelected: 'heatmap-circleSelected',
        }
    }

    get defaultOptions() {
        return {
            pos: {x: 30, y: 50},
            title: "Heatmap",
            // Width and height of one HM cell
            cellWidth: 10,
            cellHeight: 15,
            // Defines if heatmap shows scalar or categorical data
            chartType: HeatMapComponent.chartType.scalar,
            // D3 color scale or 'null' if using automatic min-max scale
            ownColorScale: null,
            // Default color schemes for automatic scales
            colorsZeroOne: ['#f7f7f7', '#0571b0'],
            colorsNegativeZeroOne: ['#ca0020', '#f7f7f7', '#0571b0'],
            colorsCategorical: ["#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00",
                "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067",
                "#329262", "#5574a6", "#3b3eac"]
        }
    }

    // Data Style
    get _dataStyle() {
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
        this.hm = SVG.group(this.parent, 'heatmap ID' + this.id, this.options.pos);

        this._initDecoration();
        this._initTooltip();
    }

    _initDecoration() {
        const decoration = {
            panelPos: {x: 0, y: -20 - 20},
            titlePos: {x: 0, y: -20 + 12}
        };
        // Put title above.
        this.hm.append('text').attrs(
          _.extend(
            {"class": 'title'},
            decoration.titlePos)
        ).text(this.options.title);

        // Creates a panel with buttons above the heat map.
        this.guiPanel = SVG.group(this.hm, 'gui-panel', decoration.panelPos);

        // Add buttons
        const select = (e, button) => () =>
          this.eventHandler.trigger(e, button.classed('selected') ? 'none' : this.id);
        const width = 15;
        const height = 10;
        const y = 3;
        const x = [0, 20];
        const rect_button = this.guiPanel.append('rect');
        rect_button.attrs({
            class: 'mapping-rect-button',
            x: x[0],
            y, width, height
        }).on('click', select(this.events.rectSelected, rect_button))

        const circle_button = this.guiPanel.append('rect');
        circle_button.attrs({
            class: 'mapping-circle-button',
            x: x[1],
            y, width, height
        }).on('click', select(this.events.circleSelected, circle_button));

        this.guiPanel.append('circle').attrs({
            cx: x[1] + 3,
            cy: y + 5,
            r: 2
        });
    }

    _initTooltip() {
        // Setup the hover tool tip.
        this.hmCells = SVG.group(this.hm, 'cells', {x: 0, y: 0});
        this.tooltip = SVG.group(this.hm, 'tooltip', {x: 5, y: 50}).attr("opacity", 0);
        this.tooltip.append('rect').attrs({
            x: -50,
            y: 0,
            width: 100,
            height: 15
        });
        this.tooltip.append('text').attrs({
            x: 0,
            y: 13
        }).text('Hallo')
    }

    // RENDER/WRANGLE METHODS
    _wrangle(data) {
        let colorScale = this.options.ownColorScale;
        // If no own color scale given, create one
        if (this.options.ownColorScale == undefined) {

            if (this.options.chartType == HeatMapComponent.chartType.scalar) {
                const max = _.max(_.flatten(data.values));
                const min = _.min(_.flatten(data.values));
                if (min < 0) {
                    const maxAbs = -min > max ? -min : max;
                    colorScale = d3.scaleLinear()
                      .domain([maxAbs, 0, maxAbs])
                      .range(this.options.colorsNegativeZeroOne);
                } else {
                    colorScale = d3.scaleLinear()
                      .domain([min, max])
                      .range(this.options.colorsZeroOne)
                }
            } else if (this.options.chartType == HeatMapComponent.chartType.categorical) {
                const allCategories = [...new Set(_.flatten(data.values))].sort();
                colorScale = d3.scaleOrdinal(this.options.colorsCategorical).domain(allCategories);
            }
        }

        // Make the data.
        let labelFormat = d3.format(".4f");
        if (!_.isNumber(data.values[0][0])) labelFormat = _.identity;
        let label = (x, y, v) => { return {row: x, col: y, label: data.labels[x][y], value: v};};
        if (!data.labels) {
            label = (x, y, v) => { return {row: x, col: y, label: labelFormat(v), value: v};};
        }

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

        // Create a heat map cell
        const hmCell = this.hmCells.selectAll(".cell").data(renderData.raw);
        hmCell.exit().remove();
        const hmUpdate = hmCell.enter().append("rect").merge(hmCell);

        const hasOpacity = renderData.opacity.length > 0 && this.options.chartType != this.chartType.scalar;
        const hover = active => d =>
          this.eventHandler.trigger(this.events.cellHovered,
            {col: d.col, row: d.row, active: active});
        hmUpdate.attrs({
            "class": d => "cell x" + d.col + " y" + d.row,
            x: d => this.scaleX(d.col),
            y: d => this.scaleY(d.row),
            width: this.scaleX(1) - this.scaleX(0),
            height: this.scaleY(1) - this.scaleY(0)
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
        const hovered = this.hm.selectAll(".x" + x + ".y" + y);
        hovered.classed('hovered', select);
        if (select) {
            const datum = hovered.datum();
            this.tooltip.attrs({
                opacity: 1,
                "transform": SVG.translate({
                    x: this.scaleX(datum.col),
                    y: this.scaleY(datum.row + 1) + 5
                })
            }).select('text').text(datum.label);
        } else {
            this.tooltip.attrs({opacity: 0});
        }
    }

    bindEvents(handler) {
        this.eventHandler = handler;
        handler.bind(this.events.cellHovered, (e, data) =>
          this.actionHoverCell(data.col, data.row, data.active));

        handler.bind(this.events.rectSelected, (e, hm_id) =>
          this.hm.selectAll('.mapping-rect-button').classed('selected', this.id == hm_id));

        handler.bind(this.events.circleSelected, (e, hm_id) =>
          this.hm.selectAll('.mapping-circle-button').classed('selected', this.id == hm_id));
    }
}

HeatMapComponent;
