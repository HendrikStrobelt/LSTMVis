class HeatMapComponent extends VComponent {

    get events() {
        return {
            itemHovered: 'HeatMap_itemHovered',
            rectSelected: 'HeatMap_rectSelected',
            circleSelected: 'HeatMap_circleSelected',
        }
    }

    _getDefaultOptions() {
        return {
            pos: {x: 30, y: 50},
            panelPos: {x: 0, y: -20 - 20},
            titlePos: {x: 0, y: -20 + 12},
            mainPos: {x: 0, y: 0},
            datatype: 'scalar',
            title: "heatmap",
            cellWidth: 10,
            cellHeight: 15,
            noAutoColorScale: null
        }
    }

    // Data Style
    _getData() {
        return {
            values: null,
            labels: null,
            opacity: []
        }
    }

    // INIT METHODS
    _init() {
        this.hm = SVG.group(this.parent, 'heatmap', this.options.pos);

        // Put title above.
        this.hm.append('text').attrs(
            _.extend(
                {"class": 'hm-title'},
                this.options.titlePos)
        ).text(this.options.title);

        this._initPanel()
        this._initTooltip();
    }

    _initPanel() {
        // Makes the panel with buttons above the heat map.
        this.mapping_panel = SVG.group(this.hm, 'mapping_panel', this.options.panelPos);
        const select = (e, but) => () => 
            this.eventHandler.trigger(e, but.classed('selected') ? 'none': this.id);
        
        const rect_button = this.mapping_panel.append('rect');
        rect_button.attrs({
            class: 'mapping-rect',
            x: 0,
            y: 3,
            width: 15,
            height: 10
        }).on('click', select(this.events.rectSelected, rect_button))
        
        const circle_button = this.mapping_panel.append('rect')
        circle_button.attrs({
            class: 'mapping-circle',
            x: 20,
            y: 3,
            width: 15,
            height: 10
        }).on('click', select(this.events.circleSelected, circle_button));
        
        this.mapping_panel.append('circle').attrs({
            cx: 20 + 3,
            cy: 3 + 5,
            r: 2
        });
    }

    _initTooltip() {
        // Setup the hover tool tip.
        this.hmCells = SVG.group(this.hm, 'cells', this.options.mainPos);        
        this.tooltip = SVG.group(this.hm, 'hm-tooltip', {x:5, y:50}).attr("opacity", 0);
        this.tooltip.append('rect').attr({
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
        let colorScale
        if (this.options.noAutoColorScale == undefined) {
            this.max = this.options.max || _.max(_.flatten(data.values));
            this.min = this.options.min || _.min(_.flatten(data.values));
            if (this.min < 0) {
                const maxAbs = -this.min > this.max ? -this.min : this.max;
                colorScale = d3.scaleLinear()
                    .domain([maxAbs, 0, maxAbs])
                    .range(['#ca0020', '#f7f7f7', '#0571b0']);
            } else {
                colorScale = d3.scaleLinear()
                    .domain([this.min, this.max])
                    .range(['#f7f7f7', '#0571b0'])
            }
        }

        // Make the data.
        const labelFormat = d3.format(".4f");
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
        this.scaleY = d3.scaleLinear().domain([0, 1])
            .range([0, this.options.cellHeight]);
        this.scaleX = d3.scaleLinear().domain([0, 1])
            .range([0, this.options.cellWidth]);

        // Create a heat map cell
        let hmCell = this.hmCells.selectAll(".hmCell").data(renderData.raw);
        hmCell.exit().remove();
        let hmUpdate = hmCell.enter().append("rect").merge(hmCell);

        const has_opacity = renderData.opacity.length > 0 && this.options.datatype != 'scalar';
        const hover = active => d => 
                this.eventHandler.trigger(this.events.itemHovered,
                                          {col: d.col, row: d.row, active: active})
        hmUpdate.attrs({
            "class": d => "hmCell x" + d.col + " y" + d.row,
            x: d => this.scaleX(d.col),
            y: d => this.scaleY(d.row),
            width: this.scaleX(1) - this.scaleX(0),
            height: this.scaleY(1) - this.scaleY(0)
        })
            .styles({
                fill: d => renderData.colorScale(d.value),
                opacity: d => (has_opacity) ? renderData.opacity[d.col][d.row] : null
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
                "transform": SVG.translate({x: this.scaleX(datum.col),
                                            y: this.scaleY(datum.row + 1) + 5 + this.options.mainPos.y})
            }).select('text').text(datum.label);
        } else {
            this.tooltip.attr({opacity: 0});
        }
    }


    bindEvents(handler) {
        this.eventHandler = handler;
        // handler.bind('draw', this.draw());
        handler.bind(this.events.itemHovered, (e, data) =>
            this.actionHoverCell(data.col, data.row, data.active));
        
        handler.bind(this.events.rectSelected, (e, hm_id) =>
            this.hm.selectAll('.mapping-rect').classed('selected', this.id == hm_id));
        
        handler.bind(this.events.circleSelected, (e, hm_id) =>
            this.hm.selectAll('.mapping-circle').classed('selected', this.id == hm_id));        
    }
}

HeatMapComponent;
